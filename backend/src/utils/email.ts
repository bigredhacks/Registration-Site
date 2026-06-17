import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.RESEND_FROM_ADDRESS || 'BigRed//Hacks <noreply@bigredhacks.com>';

let resendClient: Resend | null = null;
function getClient(): Resend | null {
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

interface ConfirmationParams {
  to: string;
  firstName: string;
}

export async function sendRegistrationConfirmation({ to, firstName }: ConfirmationParams): Promise<void> {
  const client = getClient();
  if (!client) {
    console.warn('[email] RESEND_API_KEY not set — skipping confirmation email');
    return;
  }

  const { error } = await client.emails.send({
    from: fromAddress,
    to,
    subject: 'Your BigRed//Hacks application is in!',
    html: `
      <p>Hi ${escapeHtml(firstName) || 'hacker'},</p>
      <p>Thanks for applying to BigRed//Hacks Fall 2026 — we got your application.</p>
      <p>We'll review submissions and get back to you with next steps soon. In the meantime,
      keep an eye on your inbox for updates.</p>
      <p>— The BigRed//Hacks team</p>
    `.trim(),
  });

  if (error) {
    console.error('[email] Resend error:', error);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]!));
}
