import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/invite
// Body: { email, name, role, recordId }
// Creates a Supabase auth user via invite (sends magic link to set password)
// and links the auth user_id back to the app table record.

const ROLE_TABLE: Record<string, string> = {
  carer: 'carers',
  client: 'clients',
  nominee: 'nominees',
  provider: 'providers',
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'

export async function POST(req: NextRequest) {
  try {
    const { email, name, role, recordId } = await req.json()

    if (!email || !role || !recordId) {
      return NextResponse.json({ error: 'Missing email, role, or recordId' }, { status: 400 })
    }

    const table = ROLE_TABLE[role]
    if (!table) {
      return NextResponse.json({ error: `Unknown role: ${role}` }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check if a Supabase auth user already exists with this email
    const { data: existingUsers } = await admin.auth.admin.listUsers()
    const existing = existingUsers?.users?.find(u => u.email === email)

    let userId: string

    if (existing) {
      // User already has an auth account — just link them to this record
      userId = existing.id
    } else {
      // Invite the user — Supabase sends them an email with a magic link
      // to set their own password. The redirect goes to our confirm page.
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${APP_URL}/auth/confirm?role=${role}`,
        data: { name, role },
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      userId = data.user.id
    }

    // Link the auth user_id back to the app table record
    const { error: updateError } = await admin
      .from(table)
      .update({ user_id: userId })
      .eq('id', recordId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, userId })
  } catch (err: any) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: err.message || 'Invite failed' }, { status: 500 })
  }
}
