// Email sender — uses Brevo (formerly Sendinblue) transactional API
// Previously used Resend; switched for testing flexibility (300 emails/day free,
// delivers to real addresses without domain verification)

const FROM_NAME = 'CareTime'
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'noreply@caretime.app'

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
}) {
  const apiKey = process.env.BREVO_API_KEY

  if (!apiKey) {
    console.warn('BREVO_API_KEY not set — email not sent:', subject)
    return { skipped: true }
  }

  const recipients = Array.isArray(to) ? to : [to]

  const body = {
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    to: recipients.map(email => ({ email })),
    subject,
    htmlContent: html,
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const error = await res.json()
      console.error('Brevo send error:', error)
      throw new Error(error.message || 'Failed to send email')
    }

    return await res.json()
  } catch (err) {
    console.error('Failed to send email:', err)
    throw err
  }
}
