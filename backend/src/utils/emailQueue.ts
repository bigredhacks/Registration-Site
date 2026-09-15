import { getEmailTemplate, expireInvitations } from './emailSettings';
import { EMAIL_TEMPLATE_VERSION, type EmailTemplate } from './emailTemplates';
import { supabase } from '../config/supabase';
import { deliveryEnabled, emailPayload, EmailSendError, sendEmail, type EmailPayload } from './email';

export interface EmailJob {
  id: string; kind: 'confirmation' | 'approved' | 'rejected' | 'waitlisted' | 'test'; recipient: string;
  first_name: string | null; form_title: string | null; request_payload: EmailPayload | null;
  attempts: number; lease_token: string;
}

export interface QueueStore {
  confirmationTemplate?: () => Promise<EmailTemplate>;
  claim: () => Promise<EmailJob | null>;
  save: (job: EmailJob, changes: Record<string, unknown>) => Promise<void>;
}
export const queueStore: QueueStore = {
  confirmationTemplate: () => getEmailTemplate('confirmation'),
  async claim() {
    const { data, error } = await supabase.rpc('claim_email_job').abortSignal(AbortSignal.timeout(4000));
    if (error) throw new Error('Could not claim an email job.');
    return data?.[0] ?? null;
  },
  async save(job, changes) {
    const { data, error } = await supabase.from('email_outbox').update(changes)
      .eq('id', job.id).eq('state', 'sending').eq('lease_token', job.lease_token).select('id')
      .abortSignal(AbortSignal.timeout(4000));
    if (error || !data?.length) throw new Error('Email job could not be saved or its lease changed.');
  },
};

export async function processEmailJob(job: EmailJob, store: QueueStore, send = sendEmail, now = Date.now) {
  let payload = job.request_payload;
  if (!payload) {
    let template: EmailTemplate | undefined;
    try {
      template = job.kind === 'confirmation' ? await store.confirmationTemplate?.() : undefined;
    } catch {
      // A broken template must not stop unrelated jobs with already-saved content.
      await store.save(job, {
        state: job.attempts < 6 ? 'queued' : 'failed', lease_until: null, lease_token: null,
        available_at: new Date(now() + Math.min(3600, 60 * 2 ** Math.min(job.attempts, 6)) * 1000).toISOString(),
        last_error: 'Could not load the confirmation template. Check its Storage files and retry.',
      });
      return;
    }
    try {
      if (job.kind !== 'confirmation') throw new Error('Email snapshot is missing.');
      payload = emailPayload('confirmation', job.recipient, job.first_name, job.form_title ?? undefined, template);
    } catch {
      await store.save(job, { state: 'failed', last_error: 'Invalid email details or configuration. Review before retrying.', lease_until: null, lease_token: null });
      return;
    }
    // Never send unless the exact retry payload is durably saved first.
    await store.save(job, { request_payload: payload, template_version: `${EMAIL_TEMPLATE_VERSION}/${template?.version ?? 0}` });
  }
  let resendId: string;
  try { resendId = await send(payload, `brh-email/${job.id}`); }
  catch (error) {
    const retryable = !(error instanceof EmailSendError) || error.retryable;
    const retry = retryable && job.attempts < 6;
    await store.save(job, {
      state: retry ? 'queued' : 'failed', lease_until: null, lease_token: null,
      available_at: new Date(now() + Math.min(3600, 60 * 2 ** Math.min(job.attempts, 6)) * 1000).toISOString(),
      last_error: error instanceof EmailSendError ? error.message : 'Resend request timed out or failed. The same message key will be reused.',
    });
    return;
  }
  // A failed success-write leaves the lease to expire; its retry uses the same
  // frozen payload and provider key, including after a process crash.
  await store.save(job, { state: 'sent', resend_id: resendId, sent_at: new Date(now()).toISOString(), last_error: null, lease_until: null, lease_token: null });
}

export async function drainEmailQueue(expire = expireInvitations, {
  store = queueStore, send = sendEmail, now = Date.now,
  pause = () => new Promise<void>(resolve => setTimeout(resolve, 600)),
} = {}) {
  const started = now();
  // Invitation expiry runs even when outbound email is paused.
  const expired = await expire();
  if (!deliveryEnabled()) return { processed: 0, paused: true, expired };
  // One lookup/download per pass, including a failed lookup. Refresh next pass;
  // frozen jobs never load a template. No process-wide cache can go stale.
  let templatePromise: Promise<EmailTemplate> | undefined;
  const runStore: QueueStore = { ...store, confirmationTemplate: store.confirmationTemplate
    ? () => templatePromise ??= store.confirmationTemplate!() : undefined };
  let processed = 0;
  // Scheduled functions allow 30s. Reserve up to 25s, including Storage downloads.
  while (now() - started < 4000 && processed < 20) {
    const job = await runStore.claim();
    if (!job) break;
    await processEmailJob(job, runStore, send, now);
    processed++;
    await pause();
  }
  return { processed, paused: false, expired };
}
