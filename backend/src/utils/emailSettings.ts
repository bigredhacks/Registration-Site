import { randomUUID } from 'node:crypto';
import { supabase } from '../config/supabase';
import { DEFAULT_EMAIL_TEMPLATES, defaultTemplateHtml, addEmailBranding, type EmailKind, type EmailTemplate } from './emailTemplates';

export interface InvitationSettings { deadline: string | null; time_zone: string; version: number }
export async function getInvitationSettings(): Promise<InvitationSettings> {
  const { data, error } = await supabase.from('invitation_settings').select('deadline,time_zone,version').eq('id', 'registration').abortSignal(AbortSignal.timeout(4000)).single();
  if (error || !data) throw new Error('Could not load the invitation deadline.');
  return data;
}
export const EMAIL_TEMPLATE_BUCKET = 'email-templates';
export function defaultStoredTemplate(kind: EmailKind): EmailTemplate {
  return { ...DEFAULT_EMAIL_TEMPLATES[kind], html: defaultTemplateHtml(kind) };
}
export async function getEmailTemplate(kind: EmailKind): Promise<EmailTemplate> {
  const { data, error } = await supabase.from('email_template_files').select('storage_path,version').eq('kind', kind).abortSignal(AbortSignal.timeout(4000)).maybeSingle();
  if (error) throw new Error('Could not load the email template revision.');
  if (!data) return defaultStoredTemplate(kind);
  const bucket = supabase.storage.from(EMAIL_TEMPLATE_BUCKET);
  const [html, settings] = await Promise.all([
    bucket.download(`${data.storage_path}/template.html`, {}, { signal: AbortSignal.timeout(4000) }),
    bucket.download(`${data.storage_path}/settings.json`, {}, { signal: AbortSignal.timeout(4000) }),
  ]);
  if (html.error || settings.error || !html.data || !settings.data) throw new Error('Could not download the saved email template.');
  const content = JSON.parse(await settings.data.text());
  const htmlText = await html.data.text();
  if (typeof content.subject !== 'string' || typeof content.body !== 'string' || typeof content.button_label !== 'string') throw new Error('Invalid email template settings.');
  if (!htmlText.trim() || (kind === 'approved' && (!htmlText.includes('{{deadline_sentence}}') || !htmlText.includes('{{dashboard_url}}')))) throw new Error('Invalid email template HTML.');
  return { subject: content.subject, body: content.body, button_label: content.button_label, html: addEmailBranding(htmlText), version: data.version };
}
export async function saveEmailTemplate(kind: EmailKind, template: EmailTemplate, expectedVersion: number, adminId: string) {
  const storagePath = `${kind}/${randomUUID()}`;
  const bucket = supabase.storage.from(EMAIL_TEMPLATE_BUCKET);
  // Immutable revision files: activate only once both uploads succeed. Never overwrite an active revision.
  const uploads = await Promise.all([
    bucket.upload(`${storagePath}/template.html`, template.html!, { contentType: 'text/html', upsert: false, cacheControl: '0' }),
    bucket.upload(`${storagePath}/settings.json`, JSON.stringify({ subject: template.subject, body: template.body, button_label: template.button_label }), { contentType: 'application/json', upsert: false, cacheControl: '0' }),
  ]);
  if (uploads.some(result => result.error)) throw new Error('Could not upload the email template files. The active template has not changed.');
  // Do not delete files after an uncertain activation response: the database may have committed.
  const { data, error } = await supabase.rpc('activate_email_template_files', { p_kind: kind, p_storage_path: storagePath, p_expected_version: expectedVersion, p_admin_id: adminId });
  if (error) return { data: null, error };
  return { data: { ...template, version: data.version }, error: null };
}
export async function expireInvitations() {
  const { data, error } = await supabase.rpc('expire_registration_invitations').abortSignal(AbortSignal.timeout(4000));
  if (error) throw new Error('Could not update expired invitations.');
  return data as number;
}
