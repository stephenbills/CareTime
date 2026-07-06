import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProvider } from '@/lib/api/auth'

// POST /api/update-email
// Body: { userId, newEmail }
// Updates the email in Supabase auth — the app table is updated by the
// normal save flow in the form, this just keeps auth in sync.
// SECURITY: only a logged-in Provider or Administrator may call this.

export async function POST(req: NextRequest) {
  try {
    const caller = await requireProvider()
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, newEmail } = await req.json()

    if (!userId || !newEmail) {
      return NextResponse.json({ error: 'Missing userId or newEmail' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { error } = await admin.auth.admin.updateUserById(userId, {
      email: newEmail,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log('[/api/update-email] Email updated for', userId, 'by provider', caller.providerId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Email update error:', err)
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 })
  }
}
