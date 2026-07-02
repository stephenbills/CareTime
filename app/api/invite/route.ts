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

    // Check if user already exists
    const { data: existingData } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const existing = existingData?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    )

    let userId: string

    if (existing) {
      console.log('[/api/invite] User already exists:', existing.id)
      userId = existing.id
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

      // Send password reset via Supabase so they can set their own password
      const resetUrl = `${APP_URL}/auth/reset-password`
      const { error: resetError } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: resetUrl },
      })

      if (resetError) {
        console.warn('[/api/invite] generateLink error:', resetError.message)
      } else {
        console.log('[/api/invite] Password reset link generated')
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

    // Always send a Brevo welcome email with login instructions
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

    return NextResponse.json({ success: true, userId })

  } catch (err: any) {
    console.error('[/api/invite] Unexpected error:', err.message)
    return NextResponse.json({ error: err.message || 'Invite failed' }, { status: 500 })
  }
}
