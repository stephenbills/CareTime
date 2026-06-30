import { Resend } from 'resend'

// Server-side only — never import this in a 'use client' component
const FROM_ADDRESS = process.env.EMAIL_FROM || 'CareTime <onboarding@resend.dev>'

// Lazily instantiate so a missing API key at build time doesn't crash the build —
// the key is only required at runtime when an email actually needs to be sent.
let client: Resend | null = null
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!client) client = new Resend(process.env.RESEND_API_KEY)
  return client
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
}) {
  const resend = getClient()
  if (!resend) {
    console.warn('RESEND_API_KEY not set — email not sent:', subject)
    return { skipped: true }
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    })
    return result
  } catch (err) {
    console.error('Failed to send email:', err)
    throw err
  }
}
