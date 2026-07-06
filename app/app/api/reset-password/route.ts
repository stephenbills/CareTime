import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    console.log('[/api/reset-password] Request for:', email)

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check service role key is present before attempting admin calls
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[/api/reset-password] Missing SUPABASE_SERVICE_ROLE_KEY')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const admin = createAdminClient()

    // Generate reset link with a timeout
    const linkPromise = admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${APP_URL}/auth/reset-password` },
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out after 8 seconds')), 8000)
    )

    const { data, error } = await Promise.race([linkPromise, timeoutPromise]) as any

    if (error) {
      console.error('[/api/reset-password] generateLink error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const resetLink = data?.properties?.action_link
    console.log('[/api/reset-password] Link generated:', !!resetLink)

    if (!resetLink) {
      console.error('[/api/reset-password] No action_link in response:', JSON.stringify(data))
      return NextResponse.json({ error: 'Could not generate reset link' }, { status: 500 })
    }

    // Send via Brevo API directly
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr>
          <td style="background-color:#2563eb;padding:20px 28px;">
            <span style="color:#ffffff;font-size:16px;font-weight:600;">CareTime</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px;">
            <h1 style="margin:0 0 12px 0;font-size:18px;color:#111827;">Reset Your Password</h1>
            <p style="margin:0 0 20px 0;font-size:14px;color:#4b5563;line-height:1.5;">
              Click the button below to set a new password. This link expires in 24 hours.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:20px 0;">
              <tr>
                <td style="background-color:#2563eb;border-radius:8px;">
                  <a href="${resetLink}" style="display:inline-block;padding:10px 20px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                    Reset Password
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#9ca3af;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px;background-color:#f9fafb;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">This is an automated message from CareTime.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    await sendEmail({ to: email, subject: 'Reset your CareTime password', html })
    console.log('[/api/reset-password] Reset email sent via Brevo to', email)
    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('[/api/reset-password] Error:', err.message)
    return NextResponse.json(
      { error: err.message?.includes('timed out') ? 'Request timed out — please try again' : (err.message || 'Failed to send reset email') },
      { status: 500 }
    )
  }
}

