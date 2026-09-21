import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { validate } from '../middleware/validate';
import { expireInvitations, getEmailTemplate, getInvitationSettings } from '../utils/emailSettings';
import { deliveryEnabled, emailPayload, validEmail, EMAIL_TEMPLATE_VERSION } from '../utils/email';
import type { AnnouncementAudience } from '../utils/announcementAudience';

// Mounted under the authenticated, admin-only email routes.
const router = Router();
const audienceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }).strict(),
  z.object({ type: z.literal('acceptance'), status: z.enum(['pending', 'approved', 'waitlisted', 'rejected']) }).strict(),
  z.object({ type: z.literal('invitation'), status: z.enum(['unanswered', 'accepted', 'declined', 'expired']) }).strict(),
]);

router.post('/drafts', validate({ body: z.object({ audience: audienceSchema, expected_version: z.number().int().min(0) }).strict() }), async (req, res) => {
  try {
    await expireInvitations();
    const [template, settings] = await Promise.all([getEmailTemplate('announcement'), getInvitationSettings()]);
    if (template.version !== req.body.expected_version) {
      res.status(409).json({ error: 'The announcement changed. Reload the email before reviewing recipients.' }); return;
    }
    const audience: AnnouncementAudience = req.body.audience;
    let query = supabase.from('registrations')
      .select('id,email,first_name,last_name', { count: 'exact' }).eq('form_key', 'registration');
    if (audience.type === 'acceptance') query = query.eq('status', audience.status);
    if (audience.type === 'invitation') {
      if (audience.status === 'expired') query = query.not('invitation_expired_at', 'is', null);
      else {
        query = query.eq('released_status', 'approved').is('invitation_expired_at', null);
        query = audience.status === 'unanswered' ? query.is('invitation_response', null) : query.eq('invitation_response', audience.status);
      }
    }
    const { data, count, error } = await query.order('id').range(0, 999);
    if (error) throw error;
    if ((count ?? 0) > 1000) { res.status(400).json({ error: 'More than 1,000 applicants match. Choose a smaller status group.' }); return; }
    const messages = [];
    const skipped = [];
    const recipients = new Set<string>();
    for (const row of data ?? []) {
      if (!validEmail(row.email)) { skipped.push({ id: row.id, reason: 'Missing or invalid email.' }); continue; }
      const recipient = row.email.trim();
      if (recipients.has(recipient.toLowerCase())) { skipped.push({ id: row.id, reason: 'Duplicate email address.' }); continue; }
      recipients.add(recipient.toLowerCase());
      messages.push({ id: row.id, recipient, first_name: row.first_name, name: [row.first_name, row.last_name].filter(Boolean).join(' '),
        template_version: `${EMAIL_TEMPLATE_VERSION}/${template.version}`,
        payload: emailPayload('announcement', recipient, row.first_name, undefined, template, settings.deadline, settings.time_zone) });
    }
    if (!messages.length) { res.status(400).json({ error: 'No applicants with a valid email match this group.', skipped }); return; }
    const { data: batch, error: writeError } = await supabase.from('email_batches')
      .insert({ kind: 'announcement', created_by: req.user!.id, audience, messages }).select('id').single();
    if (writeError) throw writeError;
    res.status(201).json({ id: batch.id, audience, recipients: messages.map(({ id, recipient, name }) => ({ id, recipient, name })),
      skipped, preview: messages[0].payload, enabled: deliveryEnabled() });
  } catch { res.status(500).json({ error: 'Could not prepare the announcement. Check the announcement migration and email configuration.' }); }
});

router.post('/drafts/:id/send', validate({ params: z.object({ id: z.uuid() }) }), async (req, res) => {
  if (!deliveryEnabled()) { res.status(503).json({ error: 'Email delivery is paused or Resend is not configured.' }); return; }
  try {
    const { data, error } = await supabase.rpc('queue_announcement_email_batch', { p_batch_id: req.params.id, p_admin_id: req.user!.id });
    if (error) {
      const status = error.code === 'PT400' ? 400 : error.code === 'PT403' ? 403 : error.code === 'PT404' ? 404 : error.code === 'PT409' ? 409 : 500;
      res.status(status).json({ error: status === 500 ? 'Could not queue the announcement.' : error.message }); return;
    }
    res.status(202).json(data);
  } catch { res.status(500).json({ error: 'Could not confirm queueing. Retrying this same preview is safe.' }); }
});

export default router;
