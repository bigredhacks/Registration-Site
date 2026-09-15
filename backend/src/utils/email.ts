import { z } from 'zod';
import { renderEmailTemplate, type EmailKind, type EmailPayload, type EmailTemplate } from './emailTemplates';
export { EMAIL_TEMPLATE_VERSION } from './emailTemplates';
export type { EmailKind, EmailPayload } from './emailTemplates';
export const validEmail = (value: unknown): value is string => typeof value === 'string' && z.email().safeParse(value.trim()).success;

export function emailSiteUrl() {
  const url = new URL(process.env.EMAIL_SITE_URL || 'https://brh-registration-portal.netlify.app');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('EMAIL_SITE_URL must be a public HTTPS site URL.');
  return url.origin;
}

export function deliveryEnabled() {
  return process.env.EMAIL_DELIVERY_ENABLED === 'true' && !!process.env.RESEND_API_KEY;
}

export function renderEmail(kind: EmailKind, firstName?: string | null, formTitle?: string, template?: EmailTemplate, deadline: string | null = null, timeZone?: string) {
  return renderEmailTemplate(kind, firstName, formTitle, emailSiteUrl(), template, deadline, timeZone);
}

export function emailPayload(kind: EmailKind, recipient: string, name?: string | null, formTitle?: string, template?: EmailTemplate, deadline: string | null = null, timeZone?: string): EmailPayload {
  if (!validEmail(recipient)) throw new Error('Recipient email is missing or invalid.');
  return { from: process.env.RESEND_FROM_ADDRESS || 'BigRed//Hacks <noreply@bigredhacks.com>',
    to: recipient.trim(), ...renderEmail(kind, name, formTitle, template, deadline, timeZone) };
}

export class EmailSendError extends Error {
  constructor(message: string, public retryable: boolean) { super(message); }
}

/** Resend HTTP API exposes status codes and allows a bounded request timeout. */
export async function sendEmail(payload: EmailPayload, idempotencyKey: string): Promise<string> {
  if (!process.env.RESEND_API_KEY) throw new EmailSendError('Resend API key is not configured.', false);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({})) as { id?: string; name?: string };
  if (!response.ok) {
    // Do not persist provider response bodies, which can include recipient details.
    throw new EmailSendError(`Resend returned HTTP ${response.status}${data.name ? ` (${data.name})` : ''}.`,
      response.status === 429 || response.status >= 500 || (response.status === 409 && data.name === 'concurrent_idempotent_requests'));
  }
  if (!data.id) throw new EmailSendError('Resend returned no message ID; delivery is unconfirmed.', true);
  return data.id;
}
