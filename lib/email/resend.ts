// Email sender — uses Brevo (formerly Sendinblue) transactional API
// Previously used Resend; switched for testing flexibility (300 emails/day free,
// delivers to real addresses without domain verification)

const FROM_NAME = 'CareTime'
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'noreply@caretime.app'

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string | string[]
  subject: string
  html: string
  attachments?: { name: string; content: string }[] // base64 encoded content
}) {
  const apiKey = process.env.BREVO_API_KEY

  if (!apiKey) {
    console.warn('BREVO_API_KEY not set — email not sent:', subject)
    return { skipped: true }
  }

  const recipients = Array.isArray(to) ? to : [to]

  const body: any = {
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    to: recipients.map(email => ({ email })),
    subject,
    htmlContent: html,
  }

  if (attachments && attachments.length > 0) {
    body.attachment = attachments.map(a => ({
      name: a.name,
      content: a.content,
    }))
  }

  // Retry only the network-level fetch (e.g. the connect-timeout that prompted
  // this) — not a clean-but-bad Brevo response like an invalid API key, which
  // would just fail identically on every attempt.
  const MAX_ATTEMPTS = 2
  let res: Response | undefined
  let lastErr: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      break
    } catch (err) {
      lastErr = err
      console.error(`Brevo fetch failed (attempt ${attempt}/${MAX_ATTEMPTS}):`, err)
      if (attempt < MAX_ATTEMPTS) await new Promise(r => setTimeout(r, 1000))
    }
  }
  if (!res) throw lastErr

  if (!res.ok) {
    const error = await res.json()
    console.error('Brevo send error:', error)
    throw new Error(error.message || 'Failed to send email')
  }

  return await res.json()
}
