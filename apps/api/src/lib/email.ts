import { Resend } from 'resend';
import { env } from '../env';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]!);
}

export async function sendNotificationEmail(to: string, subject: string, body: string): Promise<void> {
  if (!resend) return;

  try {
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM,
      to,
      subject,
      text: body,
      html: `<main style="font-family:Arial,sans-serif;line-height:1.6;color:#17211d"><h1 style="font-size:20px">${escapeHtml(subject)}</h1><p>${escapeHtml(body)}</p><p style="color:#66736d">Luma Bridge</p></main>`,
    });
    if (error) console.error('[email] Resend delivery failed', error.message);
  } catch (error) {
    console.error('[email] Resend request failed', error);
  }
}