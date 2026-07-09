import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import * as templates from '@/lib/email/templates'
import { requireUser } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

// Maps a notification "type" string to its template function.
// The client calls this route with { type, to, data } and never touches Resend directly.
const TEMPLATE_MAP: Record<string, (data: any) => { subject: string; html: string }> = {
  activity_assigned: templates.activityAssignedEmail,
  activity_accepted: templates.activityAcceptedEmail,
  activity_declined: templates.activityDeclinedEmail,
  activity_reminder: templates.activityReminderEmail,
  shift_submitted: templates.shiftSubmittedEmail,
  shift_approved: templates.shiftApprovedEmail,
  shift_rejected: templates.shiftRejectedEmail,
  payment_approved: templates.paymentApprovedEmail,
  unapproved_reminder: templates.unapprovedReminderEmail,
  activity_changed: templates.activityChangedEmail,
  carer_reallocated: templates.carerReallocatedEmail,
  event_report: templates.eventReportEmail,
  invoice_generated: templates.invoiceGeneratedEmail,
  provider_relationship_request: templates.providerRelationshipRequestEmail,
  welcome: templates.welcomeEmail,
  details_updated: templates.detailsUpdatedEmail,
}

// Notification types tied to a specific activity — the caller must be that
// activity's client, carer, or provider to trigger it.
const ACTIVITY_TIED_TYPES = new Set([
  'activity_assigned', 'activity_accepted', 'activity_declined', 'activity_reminder',
  'shift_submitted', 'shift_approved', 'shift_rejected', 'payment_approved',
  'activity_changed', 'carer_reallocated', 'event_report',
])

// Notification types only a Provider or Administrator should be able to trigger.
const PROVIDER_ONLY_TYPES = new Set([
  'invoice_generated', 'unapproved_reminder', 'welcome', 'provider_relationship_request',
])

// SECURITY: without this, any authenticated user (including a client) could send
// any of these templates to any email address with arbitrary data — an open,
// branded email relay. This ties each type to a real relationship between the
// caller and the thing the notification is about.
async function isAuthorized(userId: string, type: string, data: any) {
  const supabase = await createClient()

  if (ACTIVITY_TIED_TYPES.has(type)) {
    const activityId = data?.activityId
    if (!activityId) return false
    const { data: activity } = await supabase
      .from('activities').select('provider_id, client_id, carer_id').eq('id', activityId).maybeSingle()
    if (!activity) return false

    const [{ data: client }, { data: carer }, { data: provider }] = await Promise.all([
      activity.client_id
        ? supabase.from('clients').select('id').eq('id', activity.client_id).eq('user_id', userId).maybeSingle()
        : Promise.resolve({ data: null }),
      activity.carer_id
        ? supabase.from('carers').select('id').eq('id', activity.carer_id).eq('user_id', userId).maybeSingle()
        : Promise.resolve({ data: null }),
      activity.provider_id
        ? supabase.from('providers').select('id').eq('id', activity.provider_id).eq('user_id', userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    return !!(client || carer || provider)
  }

  if (type === 'details_updated') {
    const personId = data?.personId
    if (!personId) return false
    const table = data?.role === 'worker' ? 'carers' : 'clients'
    const { data: person } = await supabase
      .from(table).select('id').eq('id', personId).eq('user_id', userId).maybeSingle()
    return !!person
  }

  if (PROVIDER_ONLY_TYPES.has(type)) {
    const [{ data: provider }, { data: admin }] = await Promise.all([
      supabase.from('providers').select('id').eq('user_id', userId).maybeSingle(),
      supabase.from('administrators').select('id').eq('user_id', userId).maybeSingle(),
    ])
    return !!(provider || admin)
  }

  // Unrecognised type not covered by any rule above — deny by default.
  return false
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY: only logged-in users (any role) may trigger notifications.
    // Without this, the route is an open email relay.
    const user = await requireUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, to, data } = body

    console.log('[/api/notify] Received:', type, 'to:', to)

    if (!type || !to) {
      return NextResponse.json({ error: 'Missing type or recipient' }, { status: 400 })
    }

    const templateFn = TEMPLATE_MAP[type]
    if (!templateFn) {
      return NextResponse.json({ error: `Unknown notification type: ${type}` }, { status: 400 })
    }

    if (!(await isAuthorized(user.id, type, data))) {
      return NextResponse.json({ error: 'Not authorized to send this notification' }, { status: 403 })
    }

    const { subject, html } = templateFn(data || {})
    console.log('[/api/notify] Sending:', subject, 'to:', to)

    const result = await sendEmail({ to, subject, html })
    console.log('[/api/notify] Result:', JSON.stringify(result))

    return NextResponse.json({ success: true, result })
  } catch (err: any) {
    console.error('[/api/notify] Error:', err.message)
    return NextResponse.json({ error: err.message || 'Failed to send notification' }, { status: 500 })
  }
}
