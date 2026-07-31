import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { welcomeEmail } from '@/lib/email/templates'
import { requireProvider } from '@/lib/api/auth'

const ROLE_TABLE: Record<string, string> = {
  worker: 'carers',
  carer: 'carers',
  client: 'clients',
  nominee: 'nominees',
  provider: 'providers',
}

const ROLE_ROUTE: Record<string, string> = {
  worker: 'worker',
  carer: 'worker',
  client: 'client',
  nominee: 'client',
  provider: 'provider',
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'

// SECURITY: verifies the calling Provider is actually linked to the record they're
// trying to invite, before we link a new (or existing) auth account to it. Without
// this, any Provider could pass another Provider's client/worker recordId and
// hijack login access to that person's record. Admins may invite anyone.
async function callerOwnsRecord(
  admin: ReturnType<typeof createAdminClient>,
  caller: { providerId: string | null; isAdmin: boolean },
  role: string,
  recordId: string
) {
  if (caller.isAdmin) return true
  if (!caller.providerId) return false

  if (role === 'client') {
    const { data } = await admin.from('provider_clients')
      .select('provider_id').eq('provider_id', caller.providerId).eq('client_id', recordId).maybeSingle()
    return !!data
  }
  if (role === 'worker' || role === 'carer') {
    const { data } = await admin.from('provider_carers')
      .select('provider_id').eq('provider_id', caller.providerId).eq('carer_id', recordId).maybeSingle()
    return !!data
  }
  // 'provider' and 'nominee' roles have no established ownership relationship
  // to a calling Provider — only Administrators may invite those.
  return false
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY: only a logged-in Provider or Administrator may send invites.
    const caller = await requireProvider()
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, name, role, recordId } = await req.json()
    console.log('[/api/invite] Request:', { email, role, recordId })

    if (!email || !role || !recordId) {
      return NextResponse.json({ error: 'Missing email, role, or recordId' }, { status: 400 })
    }

    const table = ROLE_TABLE[role]
    if (!table) {
      return NextResponse.json({ error: `Unknown role: ${role}` }, { status: 400 })
    }

    const admin = createAdminClient()

    if (!(await callerOwnsRecord(admin, caller, role, recordId))) {
      return NextResponse.json({ error: 'Not authorized to invite this record' }, { status: 403 })
    }

    // Check if user already exists
    const { data: existingData } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const existing = existingData?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    )

    let userId: string
    // An existing account that has never actually signed in is still sitting on
    // the random temp password nobody knows — it genuinely needs a password-setup
    // email, same as a brand-new user. But an existing account that HAS signed in
    // before (e.g. this Client/Worker already has a working login via a different
    // Provider) already has real credentials — sending them another "Set Your
    // Password" + welcome email is confusing noise, not a real invite.
    let needsPasswordSetup = true

    if (existing) {
      console.log('[/api/invite] User already exists:', existing.id, 'last_sign_in_at:', existing.last_sign_in_at)
      userId = existing.id
      needsPasswordSetup = !existing.last_sign_in_at
    } else {
      // Create the user directly with a temporary password
      // then immediately send a password reset so they can set their own
      const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!'
      console.log('[/api/invite] Creating new auth user for', email)

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true, // auto-confirm so they can reset immediately
        user_metadata: { name, role: ROLE_ROUTE[role] || role },
      })

      if (createError) {
        console.error('[/api/invite] Create user error:', createError.message)
        return NextResponse.json({ error: createError.message }, { status: 400 })
      }

      userId = created.user.id
      console.log('[/api/invite] Created user:', userId)
    }

    // (Re)generate and send a password-setup link — for a brand-new user, or an
    // existing-but-never-signed-in one, this is how they get in at all (and is
    // what makes "Resend Invite" actually do something useful when the original
    // send failed). Skipped entirely for an already-active existing account —
    // see needsPasswordSetup above.
    let passwordEmailSent = false
    const resetUrl = `${APP_URL}/auth/reset-password`

    if (!needsPasswordSetup) {
      console.log('[/api/invite] Existing, already-active account — skipping password-setup email')
    } else {
    const { data: linkData, error: resetError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: resetUrl },
    })

    if (resetError) {
      console.warn('[/api/invite] generateLink error:', resetError.message)
    } else {
      // Link straight to our own page with the hashed token, verified via
      // supabase.auth.verifyOtp() — NOT Supabase's action_link, which
      // redirects with a PKCE ?code= requiring a code_verifier stored by
      // whichever browser initiated the flow. Since this link is generated
      // entirely server-side (no browser ever initiates it), no verifier
      // can ever exist, so exchangeCodeForSession() always failed with
      // "invalid or expired" regardless of timing — confirmed via
      // Supabase's own auth logs showing /verify succeeding while our
      // page's code exchange still failed.
      const hashedToken = linkData?.properties?.hashed_token
      if (hashedToken) {
        const directLink = `${resetUrl}?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`
        // Still route through a click-gated interstitial — the token is
        // still one-time-use, so an automated email scanner prefetching
        // the link would consume it before the person ever clicks.
        const gatedLink = `${APP_URL}/auth/verify-link?to=${encodeURIComponent(directLink)}`
        // Send via Brevo API directly — bypasses Supabase SMTP
        const resetHtml = `
<!DOCTYPE html><html><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background-color:#2563eb;padding:20px 28px;">
  <span style="color:#fff;font-size:16px;font-weight:600;">CareTime</span>
</td></tr>
<tr><td style="padding:32px 28px;">
  <h1 style="margin:0 0 12px 0;font-size:18px;color:#111827;">Set Your Password</h1>
  <p style="margin:0 0 20px 0;font-size:14px;color:#4b5563;line-height:1.5;">
    Your CareTime account has been created. Click below to set your password and get started.
  </p>
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="background-color:#2563eb;border-radius:8px;">
      <a href="${gatedLink}" style="display:inline-block;padding:10px 20px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">
        Set My Password
      </a>
    </td>
  </tr></table>
  <p style="margin:20px 0 0 0;font-size:13px;color:#9ca3af;">This link expires in 24 hours.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
        try {
          await sendEmail({ to: email, subject: 'Set your CareTime password', html: resetHtml })
          console.log('[/api/invite] Password setup email sent via Brevo to', email)
          passwordEmailSent = true
        } catch (emailErr: any) {
          console.warn('[/api/invite] Brevo reset email failed:', emailErr.message)
        }
      }
    }
    }

    // Link the auth user_id back to the app table record
    const { error: updateError } = await admin
      .from(table)
      .update({ user_id: userId })
      .eq('id', recordId)

    if (updateError) {
      console.error('[/api/invite] Failed to link user_id:', updateError.message)
    } else {
      console.log('[/api/invite] Linked user_id to', table)
    }

    // Welcome email — also skipped for an already-active existing account; its
    // "get started" copy assumes this is someone's first time on CareTime, which
    // isn't true for someone who already has a working login elsewhere.
    if (needsPasswordSetup) {
      const { subject, html } = welcomeEmail({
        name: name || email,
        role: ROLE_ROUTE[role] || role,
        loginUrl: `${APP_URL}/auth/login`,
      })

      try {
        await sendEmail({ to: email, subject, html })
        console.log('[/api/invite] Brevo welcome email sent to', email)
      } catch (emailErr: any) {
        console.warn('[/api/invite] Brevo email failed:', emailErr.message)
      }
    } else {
      console.log('[/api/invite] Existing, already-active account — skipping welcome email')
    }

    return NextResponse.json({ success: true, userId, passwordEmailSent, alreadyRegistered: !needsPasswordSetup })

  } catch (err: any) {
    console.error('[/api/invite] Unexpected error:', err.message)
    return NextResponse.json({ error: err.message || 'Invite failed' }, { status: 500 })
  }
}
