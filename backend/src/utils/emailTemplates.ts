export const EMAIL_TEMPLATE_VERSION = '2026-09-15-v3';
export type EmailKind = 'confirmation' | 'approved' | 'rejected' | 'waitlisted' | 'announcement';
export interface EmailPayload { from: string; to: string; subject: string; html: string; text: string }
export interface EmailTemplate { subject: string; body: string; button_label: string; version: number; html?: string }
export const SAMPLE_INVITATION_DEADLINE = '2026-09-21T04:00:00.000Z';
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailKind, EmailTemplate> = {
  announcement: {
    subject: 'An update from BigRed//Hacks',
    body: 'We have an update for {{form_title}}.\n\nAdd your announcement here.',
    button_label: '', version: 0,
  },
  confirmation: {
    subject: 'We received your BigRed//Hacks application',
    body: 'Thanks for applying to {{form_title}}! We received your application and will email you when a decision is ready.',
    button_label: 'View application', version: 0,
  },
  approved: {
    subject: 'You’re invited to BigRed//Hacks!',
    body: 'Congratulations! Your application to BigRed//Hacks Fall 2026 has been approved.\n\nPlease visit your dashboard to accept or decline your invitation.',
    button_label: 'Respond to invitation', version: 0,
  },
  waitlisted: {
    subject: 'You’re on the BigRed//Hacks waitlist',
    body: 'Thank you for applying to BigRed//Hacks. Your application is on our waitlist.\n\nWe’ll email you if a place becomes available. No action is needed right now.',
    button_label: 'View application', version: 0,
  },
  rejected: {
    subject: 'Your BigRed//Hacks application',
    body: 'Thank you for applying to BigRed//Hacks. Unfortunately, we’re unable to offer you a place this year.\n\nWe hope you’ll apply again next year.',
    button_label: '', version: 0,
  },
};

/** Upgrade the existing email layout without replacing edited message text or styles. */
export function addEmailBranding(html: string): string {
  if (!html.includes('data-brh-branding')) {
    html = html.replace(/<p\b[^>]*>BigRed\/\/Hacks<\/p>/, `<table data-brh-branding="true" role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 26px"><tr><td width="44" valign="middle" style="padding-right:12px"><img src="{{logo_url}}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border:0"></td><td valign="middle"><p style="margin:0;font-size:22px;font-weight:600;color:#B31B1B">BigRed//Hacks</p></td></tr></table>`);
  }
  if (!html.includes('mailto:bigredhacks@cornell.edu')) {
    const contact = '<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #eeeeee;font-size:13px;line-height:1.7;color:#666666">Contact us at <a href="mailto:bigredhacks@cornell.edu" style="color:#8B1515;text-decoration:underline">bigredhacks@cornell.edu</a></p>';
    const signoff = /<p\b[^>]*>The BigRed\/\/Hacks team<\/p>/;
    if (signoff.test(html)) html = html.replace(signoff, match => match + contact);
    else if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, contact + '</body>');
    else html += contact;
  }
  return html;
}

/** Render midnight as the end of the preceding day, with an explicit date/time. */
export function formatInvitationDeadline(deadline: string, timeZone = 'America/New_York') {
  const date = new Date(deadline);
  const clock = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date);
  const exact = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date);
  if (clock === '00:00:00') {
    const prior = new Date(date.getTime() - 1000);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(prior);
    const day = new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric', day: 'numeric' }).format(prior);
    const zone = timeZone === 'America/New_York' ? 'Eastern time' : new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value;
    return `midnight ${weekday} (${day}), ${zone}`;
  }
  return exact;
}

/** Shared layout. Editable text is escaped; HTML and inline CSS remain consistent. */
export function renderEmailTemplate(kind: EmailKind, firstName?: string | null,
  formTitle = 'BigRed//Hacks Fall 2026', siteUrl = 'https://brh-registration-portal.netlify.app',
  template: EmailTemplate = DEFAULT_EMAIL_TEMPLATES[kind], deadline: string | null = SAMPLE_INVITATION_DEADLINE,
  timeZone = 'America/New_York') {
  const name = firstName?.trim() || 'hacker';
  const dashboard = `${siteUrl}/dashboard`;
  const values: Record<string, string> = { first_name: name, form_title: formTitle, dashboard_url: dashboard, logo_url: `${siteUrl}/email-assets/brh-logo-red.png`,
    deadline: deadline ? formatInvitationDeadline(deadline, timeZone) : 'Deadline not set' };
  const fill = (value: string) => value.replace(/\{\{\s*(first_name|form_title|dashboard_url|deadline)\s*\}\}/g, (_, key: string) => values[key]);
  const subject = fill(template.subject).replace(/[\r\n]/g, ' ');
  const body = fill(template.body);
  const deadlineText = kind === 'approved' && deadline
    ? `Please accept by ${values.deadline}.` : '';
  const button = kind === 'rejected' || kind === 'announcement' ? '' : fill(template.button_label || DEFAULT_EMAIL_TEMPLATES[kind].button_label);
  const font = "'Poppins',Arial,Helvetica,sans-serif";
  const paragraphStyle = 'margin:0 0 18px;font-size:15px;line-height:1.7;color:#343434';
  const defaultHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#FDECEA;font-family:${font}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#FDECEA"><tr><td align="center" style="padding:24px 16px"><table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:8px"><tr><td style="padding:28px;font-family:${font}"><p style="margin:0 0 26px;font-size:22px;font-weight:600;color:#B31B1B">BigRed//Hacks</p><p style="${paragraphStyle}">Hi ${escapeHtml(name)},</p>${body.split(/\n\s*\n/).map(text => `<p style="${paragraphStyle}">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`).join('')}${deadlineText ? `<p style="${paragraphStyle}">${escapeHtml(deadlineText)}</p>` : ''}${button ? `<p style="margin:24px 0"><a href="${escapeHtml(dashboard)}" style="display:inline-block;padding:12px 20px;background:#B31B1B;border-radius:6px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(button)}</a></p><p style="margin:0 0 22px;font-size:12px;line-height:1.6;color:#666666">${kind === 'approved' ? 'Already responded? You’re all set.<br>' : ''}<a href="${escapeHtml(dashboard)}" style="color:#8B1515;word-break:break-all">${escapeHtml(dashboard)}</a></p>` : ''}<p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#343434">The BigRed//Hacks team</p></td></tr></table></td></tr></table></body></html>`;
  const htmlValues: Record<string, string> = { ...values, subject, button_label: button,
    message_html: body.split(/\n\s*\n/).map(text => `<p style="${paragraphStyle}">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`).join(''),
    deadline_sentence: deadlineText };
  const html = addEmailBranding(template.html || defaultHtml).replace(/\{\{\s*(first_name|form_title|dashboard_url|logo_url|deadline|subject|button_label|message_html|deadline_sentence)\s*\}\}/g,
    (_, key: string) => key === 'message_html' ? htmlValues[key] : escapeHtml(htmlValues[key]));
  const text = template.html ? htmlToPlainText(html) : [`Hi ${name},`, body, ...(deadlineText ? [deadlineText] : []), ...(button ? [`${button}: ${dashboard}`] : []), 'The BigRed//Hacks team', 'Contact us at bigredhacks@cornell.edu'].join('\n\n');
  return { subject, html, text };
}

/** Keep the plain-text alternative in sync with edits to the actual HTML file. */
function htmlToPlainText(html: string): string {
  return html.replace(/<(head|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<(?:br\s*\/?|\/p|\/div|\/tr|\/h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_, entity: string) =>
      ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }[entity]!))
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, value: string) => {
      const code = value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }).replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
}

/** A complete editable HTML file with personalization placeholders. */
export function defaultTemplateHtml(kind: EmailKind): string {
  const template = DEFAULT_EMAIL_TEMPLATES[kind];
  let html = renderEmailTemplate(kind, 'BRH_FIRST_NAME', 'BRH_FORM_TITLE', 'https://brh-dashboard-placeholder.example',
    { ...template, subject: 'BRH_SUBJECT', body: 'BRH_MESSAGE', button_label: 'BRH_BUTTON' }).html;
  html = html.replace('BRH_SUBJECT', '{{subject}}').replace('BRH_FIRST_NAME', '{{first_name}}')
    .replace(/https:\/\/brh-dashboard-placeholder\.example\/dashboard/g, '{{dashboard_url}}')
    .replace(/https:\/\/brh-dashboard-placeholder\.example\/email-assets\/brh-logo-red\.png/g, '{{logo_url}}')
    .replace(/<p style="[^"]*">BRH_MESSAGE<\/p>/, '{{message_html}}').replace('BRH_BUTTON', '{{button_label}}');
  if (kind === 'approved') html = html.replace(`Please accept by ${formatInvitationDeadline(SAMPLE_INVITATION_DEADLINE)}.`, '{{deadline_sentence}}');
  return html.replace(/></g, '>\n<');
}
