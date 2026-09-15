import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { validate } from '../middleware/validate';
import { getEmailTemplate, getInvitationSettings } from '../utils/emailSettings';
import { deliveryEnabled, emailPayload, validEmail, EMAIL_TEMPLATE_VERSION, type EmailPayload } from '../utils/email';

// Mounted behind the admin authentication middleware.
const router = Router();
const kind = z.enum(['approved', 'rejected', 'waitlisted']);
const params = z.object({ id: z.uuid() });
const body = z.object({
  decisions: z.array(z.object({ id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), expected_status: kind }).strict())
    .min(1).max(1000).refine(rows => new Set(rows.map(row => row.id)).size === rows.length),
  email_kinds: z.array(kind).max(3).refine(values => new Set(values).size === values.length),
}).strict();
type DecisionKind = z.infer<typeof kind>;
interface Student { id: number; status: string; email: string | null; first_name: string | null; last_name: string | null }
interface Message { id: number; kind: DecisionKind; recipient: string; first_name: string | null; name: string; payload: EmailPayload; template_version: string }

router.get('/config', (_req, res) => { res.json({ enabled: deliveryEnabled() }); });
router.post('/', validate({ body }), async (req, res) => {
  try {
    const { decisions, email_kinds } = req.body as z.infer<typeof body>;
    const ids = decisions.map(row => row.id);
    const rows: Student[] = [];
    for (let offset = 0; offset < ids.length; offset += 200) {
      const { data, error } = await supabase.from('registrations').select('id,status,email,first_name,last_name')
        .eq('form_key', 'registration').in('id', ids.slice(offset, offset + 200)).order('id');
      if (error) throw error;
      rows.push(...(data ?? []));
    }
    const byId = new Map(rows.map(row => [row.id, row]));
    if (decisions.some(decision => byId.get(decision.id)?.status !== decision.expected_status)) {
      res.status(409).json({ error: 'Selected decisions changed. Close this dialog and review the selection again.' }); return;
    }
    const selectedKinds = email_kinds.filter(value => decisions.some(decision => decision.expected_status === value));
    const recipients = rows.filter(row => selectedKinds.includes(row.status as DecisionKind));
    if (recipients.some(row => !validEmail(row.email))) {
      res.status(409).json({ error: 'An applicant selected for email has a missing or invalid email address. Correct it or turn off emails for that decision.' }); return;
    }
    const settings = await getInvitationSettings();
    if (selectedKinds.includes('approved') && (!settings.deadline || Date.parse(settings.deadline) <= Date.now())) {
      res.status(409).json({ error: 'Set a future deadline in Invitations before sending approval emails.' }); return;
    }
    // Load each chosen template once per preview, not once per applicant.
    const templates = new Map(await Promise.all(selectedKinds.map(async value => [value, await getEmailTemplate(value)] as const)));
    const messages: Message[] = recipients.map(row => {
      const emailKind = row.status as DecisionKind;
      const template = templates.get(emailKind)!;
      return { id: row.id, kind: emailKind, recipient: row.email!.trim(), first_name: row.first_name,
        name: [row.first_name, row.last_name].filter(Boolean).join(' '), template_version: `${EMAIL_TEMPLATE_VERSION}/${template.version}`,
        payload: emailPayload(emailKind, row.email!, row.first_name, undefined, template, settings.deadline, settings.time_zone) };
    });
    const { data, error } = await supabase.from('email_decision_releases').insert({ created_by: req.user!.id, decisions, messages,
      invitation_settings_version: settings.version }).select('id').single();
    if (error) throw error;
    res.status(201).json({ id: data.id, enabled: deliveryEnabled(), recipients: messages.map(({ id, kind, recipient, name, payload }) => ({ id, kind, recipient, name, subject: payload.subject })) });
  } catch { res.status(500).json({ error: 'Could not prepare the release. Check the release email migration and template files.' }); }
});

router.get('/:id/preview', validate({ params, query: z.object({ registration_id: z.coerce.number().int().positive() }) }), async (req, res) => {
  try {
    const { data, error } = await supabase.from('email_decision_releases').select('messages').eq('id', req.params.id).eq('created_by', req.user!.id).maybeSingle();
    if (error) throw error;
    const message = (data?.messages as Message[] | undefined)?.find(message => message.id === Number(req.query.registration_id));
    if (!message) { res.status(404).json({ error: 'Email preview not found.' }); return; }
    res.json(message.payload);
  } catch { res.status(500).json({ error: 'Could not load this email preview.' }); }
});

router.post('/:id/confirm', validate({ params, body: z.object({}).strict() }), async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('release_decisions_with_emails', {
      p_release_id: req.params.id, p_admin_id: req.user!.id, p_delivery_enabled: deliveryEnabled(),
    });
    if (error) {
      const status = ({ PT400: 400, PT403: 403, PT404: 404, PT409: 409 } as Record<string, number>)[error.code] ?? 500;
      res.status(status).json({ error: status === 500 ? 'Could not confirm release. Retry this same preview.' : error.message }); return;
    }
    res.json(data);
  } catch { res.status(500).json({ error: 'Could not confirm release. Retry this same preview.' }); }
});

router.post('/:id/test', validate({ params, body: z.object({ kind }).strict() }), async (req, res) => {
  if (!deliveryEnabled()) { res.status(503).json({ error: 'Email delivery is paused. Set EMAIL_DELIVERY_ENABLED=true and RESEND_API_KEY in Netlify, then redeploy.' }); return; }
  if (!validEmail(req.user!.email)) { res.status(400).json({ error: 'Your admin account needs a valid email address.' }); return; }
  try {
    const { data, error } = await supabase.from('email_decision_releases').select('messages').eq('id', req.params.id).eq('created_by', req.user!.id).maybeSingle();
    if (error) throw error;
    const message = (data?.messages as Message[] | undefined)?.find(message => message.kind === req.body.kind);
    if (!message) { res.status(404).json({ error: 'Email preview not found.' }); return; }
    const { error: writeError } = await supabase.from('email_outbox').upsert({
      dedupe_key: `test/release/${req.params.id}/${req.body.kind}/${req.user!.id}`, kind: 'test', recipient: req.user!.email!.trim(),
      request_payload: { ...message.payload, to: req.user!.email!.trim(), subject: `[TEST] ${message.payload.subject}` }, created_by: req.user!.id,
    }, { onConflict: 'dedupe_key', ignoreDuplicates: true });
    if (writeError) throw writeError;
    res.status(202).json({ message: `Test queued for ${req.user!.email}.` });
  } catch { res.status(500).json({ error: 'Could not queue the test. Retrying this preview is safe.' }); }
});
export default router;
