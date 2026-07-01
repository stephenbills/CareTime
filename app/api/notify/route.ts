import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import * as templates from '@/lib/email/templates'

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
}

export async function POST(req: NextRequest) {
  try {
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
