/**
 * Outgoing e-mail through Resend (https://resend.com, free tier: 100 mails a day). Server only.
 * RESEND_API_KEY: the API key. MAIL_FROM: a sender on a domain verified in Resend,
 * e.g. "Pro Tours <tickets@protoursandtravelsolutions.com>".
 */
export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM)

export class MailError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.status = status
  }
}

/** attachments: [{ filename, content: base64 }] */
export async function sendMail({ to, subject, html, text, attachments = [], replyTo }) {
  if (!mailConfigured()) throw new MailError('E-mailing tickets is not switched on yet. Please download the PDF instead.', 503)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, html, text, attachments, ...(replyTo ? { reply_to: replyTo } : {}) }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null)
  if (!res?.ok) {
    console.error('[mail] send failed', res?.status, res ? (await res.text().catch(() => '')).slice(0, 300) : 'no response')
    throw new MailError('The e-mail could not be sent right now. Please download the PDF instead.')
  }
  return (await res.json().catch(() => ({}))).id || null
}
