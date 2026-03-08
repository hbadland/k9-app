import { Resend } from 'resend';

const FROM = process.env.EMAIL_FROM ?? 'Battersea K9 <noreply@batterseak9.com>';

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', opts.to);
    return;
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });
  } catch (err) {
    console.error('[email] Failed to send to', opts.to, err);
  }
}
