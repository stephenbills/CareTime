import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { welcomeEmail } from '@/lib/email/templates'

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

export async function POST(req: NextRequest) {
  try {
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
    const confirmUrl = `${APP_URL}/auth/confirm?role=${ROLE_ROUTE[role] || role}`

    // Check if a Supabase auth user already exists with this email
    const { data: existingUsers } = await admin.auth.admin.listUsers()
    const existing = existingUsers?.users?.find((u: any) => u.email === email)

    let userId: string

    if (existing) {
      console.log('[/api/invite] User already exists, linking and sending Brevo welcome email')
      userId = existing.id

      // Send a Brevo welcome/login email manually since Supabase won't re-invite
      const { subject, html } = welcomeEmail({
        name: name || email,
        role: ROLE_ROUTE[role] || role,
        loginUrl: `${APP_URL}/auth/login`,
      })
      try {
        await sendEmail({ to: email, subject: `Your CareTime login — ${subject}`, html })
        console.log('[/api/invite] Brevo welcome email sent to', email)
      } catch (emailErr: any) {
        console.warn('[/api/invite] Brevo email failed:', emailErr.message)
        // Don't block — still link the account
      }
    } else {
      console.log('[/api/invite] Sending Supabase invite to', email)
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: confirmUrl,
        data: { name, role: ROLE_ROUTE[role] || role },
      })

      if (error) {
        console.error('[/api/invite] Supabase invite error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      userId = data.user.id
      console.log('[/api/invite] Invite sent, userId:', userId)
    }

    // Link the auth user_id back to the app table record
    const { error: updateError } = await admin
      .from(table)
      .update({ user_id: userId })
      .eq('id', recordId)

    if (updateError) {
      console.error('[/api/invite] Failed to link user_id:', updateError.message)
      // Don't fail the whole request — invite was sent, linking failed
      return NextResponse.json({
        success: true,
        userId,
        warning: `Account created but linking failed: ${updateError.message}`
      })
    }

    console.log('[/api/invite] Success — user_id linked to', table)
    return NextResponse.json({ success: true, userId })

  } catch (err: any) {
    console.error('[/api/invite] Unexpected error:', err.message)
    return NextResponse.json({ error: err.message || 'Invite failed' }, { status: 500 })
  }
}
