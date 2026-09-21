import releaseEmails from './adminReleaseEmails';
import announcements from './adminAnnouncements';
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { validate } from '../middleware/validate';
import { getEmailTemplate, getInvitationSettings, saveEmailTemplate } from '../utils/emailSettings';
import { SAMPLE_INVITATION_DEADLINE, type EmailKind } from '../utils/emailTemplates';
import { deliveryEnabled, emailPayload, emailSiteUrl, renderEmail, validEmail, EMAIL_TEMPLATE_VERSION, type EmailPayload } from '../utils/email';

// Mounted after requireAuth + requireAdmin.
const router = Router();
router.use('/releases', releaseEmails);
router.use('/announcements', announcements);
const kind = z.enum(['approved', 'rejected', 'waitlisted']);
const draftId = z.object({ id: z.uuid() });
const rpcStatus = (code: string) => code === 'PT409' ? 409 : code === 'PT404' ? 404 : code === 'PT403' ? 403 : 500;
interface DecisionRow { id: number; email: string | null; first_name: string | null; last_name: string | null; released_status: string | null; decision_released_at: string | null }
interface DraftMessage { id: number; recipient: string; name: string; released_at: string; template_version: string; payload: EmailPayload }

const templateParams = z.object({ kind: z.enum(['confirmation', 'approved', 'rejected', 'waitlisted', 'announcement']) });
const templateBody = z.object({ subject: z.string().trim().min(1).max(200).refine(value => !/[\r\n]/.test(value), 'Use one line for the subject.'),
  body: z.string().trim().min(1).max(10000), button_label: z.string().trim().max(80), html: z.string().trim().min(1).max(50000) });
router.post('/test', validate({ body: z.object({
  kind: templateParams.shape.kind, to: z.string().trim().max(254).pipe(z.email()), request_id: z.uuid(),
  first_name: z.string().trim().min(1).max(100).refine(value => !/[\r\n]/.test(value)).default('Alex'),
  form_title: z.string().trim().min(1).max(200).refine(value => !/[\r\n]/.test(value)).default('BigRed//Hacks Fall 2026'),
  expected_version: z.number().int().min(0).optional(),
}).strict() }), async (req, res) => {
  if (!deliveryEnabled()) { res.status(503).json({ error: 'Email delivery is paused. Configure Resend and enable delivery in Netlify, then redeploy.' }); return; }
  try {
    const [template, settings] = await Promise.all([getEmailTemplate(req.body.kind), getInvitationSettings()]);
    if (req.body.expected_version !== undefined && req.body.expected_version !== template.version) {
      res.status(409).json({ error: 'The template changed. Close and reopen the test form to load the latest version.' }); return;
    }
    const payload = emailPayload(req.body.kind, req.body.to, req.body.first_name, req.body.form_title, template,
      req.body.kind === 'announcement' ? settings.deadline : settings.deadline ?? SAMPLE_INVITATION_DEADLINE, settings.time_zone);
    const { error } = await supabase.from('email_outbox').upsert({
      dedupe_key: `template-test/${req.user!.id}/${req.body.request_id}/${req.body.kind}/${req.body.to}`,
      kind: 'test', recipient: req.body.to, created_by: req.user!.id,
      template_version: `${EMAIL_TEMPLATE_VERSION}/${template.version}`,
      request_payload: { ...payload, subject: `[TEST] ${payload.subject}` },
    }, { onConflict: 'dedupe_key', ignoreDuplicates: true });
    if (error) throw error;
    res.status(202).json({ message: `Test email queued for ${req.body.to}. Check History for its status.` });
  } catch { res.status(500).json({ error: 'Could not confirm the test email. Retry to check or queue the same test.' }); }
});

router.get('/templates/:kind', validate({ params: templateParams }), async (req, res) => {
  try {
    const emailKind = req.params.kind as EmailKind;
    const [template, settings] = await Promise.all([getEmailTemplate(emailKind), getInvitationSettings()]);
    const deadline = emailKind === 'announcement' ? settings.deadline : settings.deadline ?? SAMPLE_INVITATION_DEADLINE;
    res.json({ ...renderEmail(emailKind, 'Alex', undefined, template, deadline, settings.time_zone),
      template, site_url: emailSiteUrl(),
      deadline, time_zone: settings.time_zone,
      sample_deadline: emailKind !== 'announcement' && !settings.deadline, enabled: deliveryEnabled() });
  } catch { res.status(500).json({ error: 'Could not load this email. Check the email editor migration.' }); }
});
router.put('/templates/:kind', validate({ params: templateParams, body: templateBody.extend({ expected_version: z.number().int().min(0) }).strict() }), async (req, res) => {
  try {
    const { subject, body, button_label, html, expected_version } = req.body;
    if (req.params.kind === 'approved' && (!html.includes('{{deadline_sentence}}') || !html.includes('{{dashboard_url}}'))) {
      res.status(400).json({ error: 'Approval HTML must include {{deadline_sentence}} and {{dashboard_url}}.' }); return;
    }
    const { data, error } = await saveEmailTemplate(req.params.kind as EmailKind,
      { subject, body, button_label, html, version: expected_version }, expected_version, req.user!.id);
    if (error) { res.status(rpcStatus(error.code)).json({ error: error.code.startsWith('PT') ? error.message : 'Could not save this email.' }); return; }
    res.json({ template: data });
  } catch { res.status(500).json({ error: 'Could not confirm the save. Reload this email before trying again.' }); }
});

router.post('/drafts', validate({ body: z.object({ kind, ids: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).min(1).max(1000).optional(), scope: z.literal('released').optional() }).strict().refine(value => Boolean(value.ids) !== Boolean(value.scope), 'Choose selected applicants or all released decisions.') }), async (req, res) => {
  try {
    const [template, settings] = await Promise.all([getEmailTemplate(req.body.kind), getInvitationSettings()]);
    if (req.body.kind === 'approved' && (!settings.deadline || Date.parse(settings.deadline) <= Date.now())) {
      res.status(409).json({ error: 'Set a future deadline in Invitations before sending approval emails.' }); return;
    }
    let ids = [...new Set((req.body.ids ?? []) as number[])];
    const rows: DecisionRow[] = [];
    for (let offset = 0; offset < ids.length; offset += 200) {
      const { data, error } = await supabase.from('registrations')
        .select('id,email,first_name,last_name,released_status,decision_released_at')
        .eq('form_key', 'registration').in('id', ids.slice(offset, offset + 200)).order('id');
      if (error) throw error;
      rows.push(...data);
    }
    if (req.body.scope === 'released') {
      const { data, error } = await supabase.from('registrations').select('id,email,first_name,last_name,released_status,decision_released_at')
        .eq('form_key', 'registration').eq('released_status', req.body.kind).order('id').range(0, 999);
      if (error) throw error;
      const { count, error: countError } = await supabase.from('registrations').select('id', { count: 'exact', head: true })
        .eq('form_key', 'registration').eq('released_status', req.body.kind);
      if (countError) throw countError;
      if ((count ?? 0) > 1000) { res.status(400).json({ error: 'More than 1,000 applicants match. Select a smaller group in Approvals.' }); return; }
      rows.push(...(data ?? [])); ids = rows.map(row => row.id);
    }
    const byId = new Map(rows.map(row => [row.id, row]));
    const messages: DraftMessage[] = [];
    const skipped: { id: number; reason: string }[] = [];
    for (const id of ids) {
      const row = byId.get(id);
      const reason = !row ? 'Main application not found.' : row.released_status !== req.body.kind || !row.decision_released_at
        ? 'Released decision does not match this email.' : !validEmail(row.email) ? 'Missing or invalid email.' : null;
      if (reason) { skipped.push({ id, reason }); continue; }
      messages.push({ id, recipient: row!.email!.trim(), name: [row!.first_name, row!.last_name].filter(Boolean).join(' '),
        released_at: row!.decision_released_at!, template_version: `${EMAIL_TEMPLATE_VERSION}/${template.version}`,
        payload: emailPayload(req.body.kind, row!.email!, row!.first_name, undefined, template, settings.deadline, settings.time_zone) });
    }
    if (!messages.length) { res.status(400).json({ error: 'No selected applicants have a matching released decision and valid email.', skipped }); return; }
    const { data, error } = await supabase.from('email_batches').insert({ kind: req.body.kind, created_by: req.user!.id, messages, invitation_settings_version: settings.version }).select('id').single();
    if (error) throw error;
    res.status(201).json({ id: data.id, kind: req.body.kind, recipients: messages.map(({ id, recipient, name }) => ({ id, recipient, name })),
      skipped, preview: messages[0].payload, enabled: deliveryEnabled(), version: EMAIL_TEMPLATE_VERSION });
  } catch { res.status(500).json({ error: 'Could not prepare the email preview. Check the email migration and configuration.' }); }
});

router.get('/drafts/:id/preview', validate({ params: draftId, query: z.object({ registration_id: z.coerce.number().int().positive() }) }), async (req, res) => {
  try {
    const { data, error } = await supabase.from('email_batches').select('messages').eq('id', req.params.id).eq('created_by', req.user!.id).maybeSingle();
    if (error) throw error;
    const message = (data?.messages as DraftMessage[] | undefined)?.find(row => row.id === Number(req.query.registration_id));
    if (!message) { res.status(404).json({ error: 'Preview not found.' }); return; }
    res.json(message.payload);
  } catch { res.status(500).json({ error: 'Could not load this preview.' }); }
});

router.post('/drafts/:id/send', validate({ params: draftId }), async (req, res) => {
  if (!deliveryEnabled()) { res.status(503).json({ error: 'Email delivery is paused or Resend is not configured.' }); return; }
  try {
    const { data, error } = await supabase.rpc('queue_decision_email_batch', { p_batch_id: req.params.id, p_admin_id: req.user!.id });
    if (error) { res.status(rpcStatus(error.code)).json({ error: error.code.startsWith('PT') ? error.message : 'Could not queue these emails.' }); return; }
    res.status(202).json(data);
  } catch { res.status(500).json({ error: 'Could not confirm queueing. Retrying this same preview is safe.' }); }
});

router.post('/drafts/:id/test', validate({ params: draftId }), async (req, res) => {
  if (!deliveryEnabled()) { res.status(503).json({ error: 'Email delivery is paused or Resend is not configured.' }); return; }
  if (!validEmail(req.user!.email)) { res.status(400).json({ error: 'Your admin account needs a valid email address.' }); return; }
  try {
    const { data, error } = await supabase.from('email_batches').select('messages').eq('id', req.params.id).eq('created_by', req.user!.id).maybeSingle();
    if (error) throw error;
    const message = (data?.messages as DraftMessage[] | undefined)?.[0];
    if (!message) { res.status(404).json({ error: 'Email draft not found.' }); return; }
    const { error: writeError } = await supabase.from('email_outbox').upsert({
      dedupe_key: `test/${req.params.id}/${req.user!.id}`, batch_id: req.params.id, kind: 'test', recipient: req.user!.email.trim(),
      request_payload: { ...message.payload, to: req.user!.email.trim(), subject: `[TEST] ${message.payload.subject}` }, created_by: req.user!.id,
    }, { onConflict: 'dedupe_key', ignoreDuplicates: true });
    if (writeError) throw writeError;
    res.status(202).json({ message: `Test queued for ${req.user!.email}. One test is sent per preview.` });
  } catch { res.status(500).json({ error: 'Could not queue the test email.' }); }
});

router.get('/jobs', validate({ query: z.object({ state: z.enum(['queued', 'sending', 'sent', 'failed', 'needs_review', 'cancelled', '']).optional(),
  q: z.string().max(200).optional(), offset: z.coerce.number().int().min(0).default(0) }) }), async (req, res) => {
  try {
    const offset = Number(req.query.offset);
    let query = supabase.from('email_outbox').select('id,kind,recipient,state,attempts,last_error,created_at,sent_at,resend_id,first_attempt_at', { count: 'exact' })
      .order('created_at', { ascending: false }).order('id').range(offset, offset + 49);
    if (req.query.state) query = query.eq('state', req.query.state);
    if (req.query.q) query = query.ilike('recipient', `%${String(req.query.q).replace(/[%_\\]/g, '\\$&')}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data: (data ?? []).map(job => ({ ...job, can_retry: job.state === 'failed' && (!job.first_attempt_at || Date.parse(job.first_attempt_at) > Date.now() - 23 * 3600000) })), count, enabled: deliveryEnabled() });
  } catch { res.status(500).json({ error: 'Could not load email history. Check that the email migration is installed.' }); }
});

router.post('/jobs/:id/retry', validate({ params: draftId }), async (req, res) => {
  if (!deliveryEnabled()) { res.status(503).json({ error: 'Email delivery is paused.' }); return; }
  try {
    const { data, error } = await supabase.rpc('retry_email_job', { p_id: req.params.id });
    if (error) throw error;
    if (!data) { res.status(409).json({ error: 'This email cannot be retried safely. Refresh and check its status in Resend.' }); return; }
    res.status(202).json({ message: 'Email queued for retry.' });
  } catch { res.status(500).json({ error: 'Could not retry the email.' }); }
});

export default router;
