const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://caretime.vercel.app'

function wrapper(content: string, previewText = '') {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="background-color:#2563eb;padding:20px 28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:28px;height:28px;background-color:#ffffff;border-radius:50%;text-align:center;vertical-align:middle;font-weight:bold;color:#2563eb;font-size:14px;">C</td>
                  <td style="padding-left:8px;color:#ffffff;font-size:16px;font-weight:600;">CareTime</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background-color:#f9fafb;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                This is an automated message from CareTime. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function button(text: string, href: string) {
  return `
  <table cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="background-color:#2563eb;border-radius:8px;">
        <a href="${href}" style="display:inline-block;padding:10px 20px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${text}</a>
      </td>
    </tr>
  </table>`
}

function detailRow(label: string, value: string) {
  return `
  <tr>
    <td style="padding:4px 0;font-size:13px;color:#9ca3af;width:120px;">${label}</td>
    <td style="padding:4px 0;font-size:13px;color:#111827;font-weight:500;">${value}</td>
  </tr>`
}

function detailsTable(rows: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;">${rows}</table>`
}

function heading(text: string) {
  return `<h1 style="margin:0 0 12px 0;font-size:18px;color:#111827;">${text}</h1>`
}

function paragraph(text: string) {
  return `<p style="margin:0 0 12px 0;font-size:14px;color:#4b5563;line-height:1.5;">${text}</p>`
}

// ─────────────────────────────────────────────────────────────
// Templates — one function per notification type from the spec
// ─────────────────────────────────────────────────────────────

export function activityAssignedEmail(opts: {
  carerName: string; activityTitle: string; clientName: string
  startTime: string; endTime: string; activityId: string
}) {
  const content = `
    ${heading('New Activity Assigned')}
    ${paragraph(`Hi ${opts.carerName}, you've been assigned a new activity. Please review and accept or decline.`)}
    ${detailsTable(
      detailRow('Activity', opts.activityTitle) +
      detailRow('Client', opts.clientName) +
      detailRow('Start', opts.startTime) +
      detailRow('End', opts.endTime)
    )}
    ${button('View Activity', `${APP_URL}/worker/activities/${opts.activityId}`)}
  `
  return { subject: `New activity assigned: ${opts.activityTitle}`, html: wrapper(content, 'You have a new activity to review') }
}

export function activityAcceptedEmail(opts: {
  recipientName: string; carerName: string; activityTitle: string; activityId: string
}) {
  const content = `
    ${heading('Activity Accepted')}
    ${paragraph(`Hi ${opts.recipientName}, ${opts.carerName} has accepted the activity "${opts.activityTitle}".`)}
    ${button('View Activity', `${APP_URL}/worker/activities/${opts.activityId}`)}
  `
  return { subject: `Activity accepted: ${opts.activityTitle}`, html: wrapper(content) }
}

export function activityDeclinedEmail(opts: {
  recipientName: string; carerName: string; activityTitle: string; activityId: string
}) {
  const content = `
    ${heading('Activity Declined')}
    ${paragraph(`Hi ${opts.recipientName}, ${opts.carerName} has declined the activity "${opts.activityTitle}". Please reassign a Worker.`)}
    ${button('Reassign Activity', `${APP_URL}/worker/activities/${opts.activityId}`)}
  `
  return { subject: `Activity declined: ${opts.activityTitle}`, html: wrapper(content) }
}

export function activityReminderEmail(opts: {
  carerName: string; activityTitle: string; startTime: string
  pickupAddress: string; activityId: string
}) {
  const content = `
    ${heading('Upcoming Activity Reminder')}
    ${paragraph(`Hi ${opts.carerName}, your activity "${opts.activityTitle}" starts soon.`)}
    ${detailsTable(
      detailRow('Start', opts.startTime) +
      detailRow('Pickup', opts.pickupAddress || '—')
    )}
    ${button('View Activity', `${APP_URL}/worker/activities/${opts.activityId}`)}
  `
  return { subject: `Reminder: ${opts.activityTitle} starting soon`, html: wrapper(content) }
}

export function shiftSubmittedEmail(opts: {
  recipientName: string; carerName: string; activityTitle: string
  startTime: string; endTime: string; totalCost: string; activityId: string
  role?: string
}) {
  const role = opts.role || 'client'
  const content = `
    ${heading('Shift Submitted For Approval')}
    ${paragraph(`Hi ${opts.recipientName}, ${opts.carerName} has completed and submitted a shift for your approval.`)}
    ${detailsTable(
      detailRow('Activity', opts.activityTitle) +
      detailRow('Start', opts.startTime) +
      detailRow('End', opts.endTime) +
      detailRow('Total Cost', opts.totalCost)
    )}
    ${button('Review & Approve', `${APP_URL}/${role}/activities/${opts.activityId}`)}
  `
  return { subject: `Shift ready for approval: ${opts.activityTitle}`, html: wrapper(content, 'A shift is waiting for your approval') }
}

export function shiftApprovedEmail(opts: {
  recipientName: string; clientName: string; activityTitle: string; activityId: string
}) {
  const content = `
    ${heading('Shift Approved')}
    ${paragraph(`Hi ${opts.recipientName}, ${opts.clientName} has approved the shift "${opts.activityTitle}".`)}
    ${button('View Activity', `${APP_URL}/worker/activities/${opts.activityId}`)}
  `
  return { subject: `Shift approved: ${opts.activityTitle}`, html: wrapper(content) }
}

export function shiftRejectedEmail(opts: {
  recipientName: string; clientName: string; activityTitle: string
  rejectionReason: string; activityId: string
}) {
  const content = `
    ${heading('Shift Rejected')}
    ${paragraph(`Hi ${opts.recipientName}, ${opts.clientName} has rejected the shift "${opts.activityTitle}".`)}
    ${detailsTable(detailRow('Reason', opts.rejectionReason || 'No reason provided'))}
    ${paragraph('Please amend or withdraw this shift.')}
    ${button('Review Activity', `${APP_URL}/worker/activities/${opts.activityId}`)}
  `
  return { subject: `Shift rejected: ${opts.activityTitle}`, html: wrapper(content) }
}

export function paymentApprovedEmail(opts: {
  carerName: string; activityTitle: string; activityId: string
}) {
  const content = `
    ${heading('Payment Approved')}
    ${paragraph(`Hi ${opts.carerName}, your shift "${opts.activityTitle}" has been approved for payment.`)}
    ${button('View Activity', `${APP_URL}/worker/activities/${opts.activityId}`)}
  `
  return { subject: `Payment approved: ${opts.activityTitle}`, html: wrapper(content) }
}

export function unapprovedReminderEmail(opts: {
  providerName: string; count: number
}) {
  const content = `
    ${heading('Outstanding Shift Approvals')}
    ${paragraph(`Hi ${opts.providerName}, you have ${opts.count} shift${opts.count !== 1 ? 's' : ''} that have been awaiting Client approval for more than 7 days.`)}
    ${button('View Outstanding Shifts', `${APP_URL}/provider/reports`)}
  `
  return { subject: `${opts.count} shift${opts.count !== 1 ? 's' : ''} awaiting approval over 7 days`, html: wrapper(content) }
}

export function activityChangedEmail(opts: {
  recipientName: string; activityTitle: string; changedBy: string; activityId: string
}) {
  const content = `
    ${heading('Activity Updated')}
    ${paragraph(`Hi ${opts.recipientName}, the activity "${opts.activityTitle}" has been updated by ${opts.changedBy}.`)}
    ${button('View Activity', `${APP_URL}/worker/activities/${opts.activityId}`)}
  `
  return { subject: `Activity updated: ${opts.activityTitle}`, html: wrapper(content) }
}

export function carerReallocatedEmail(opts: {
  recipientName: string; activityTitle: string; newCarerName: string; activityId: string
}) {
  const content = `
    ${heading('Worker Reassigned')}
    ${paragraph(`Hi ${opts.recipientName}, the activity "${opts.activityTitle}" has been reassigned to ${opts.newCarerName}.`)}
    ${button('View Activity', `${APP_URL}/worker/activities/${opts.activityId}`)}
  `
  return { subject: `Worker reassigned: ${opts.activityTitle}`, html: wrapper(content) }
}

export function eventReportEmail(opts: {
  recipientName: string; clientName: string; activityTitle: string
  description: string; activityId: string
}) {
  const content = `
    ${heading('⚠ Event Report Submitted')}
    ${paragraph(`Hi ${opts.recipientName}, an event report has been logged for ${opts.clientName} during "${opts.activityTitle}".`)}
    ${detailsTable(detailRow('Description', opts.description))}
    ${button('View Full Report', `${APP_URL}/worker/activities/${opts.activityId}`)}
  `
  return { subject: `⚠ Event report: ${opts.activityTitle}`, html: wrapper(content, 'An event report requires your attention') }
}

export function invoiceGeneratedEmail(opts: {
  recipientName: string; invoiceNumber: string; periodFrom: string
  periodTo: string; totalAmount: string
}) {
  const content = `
    ${heading('New Invoice')}
    ${paragraph(`Hi ${opts.recipientName}, a new invoice is ready for your review.`)}
    ${detailsTable(
      detailRow('Invoice #', opts.invoiceNumber) +
      detailRow('Period', `${opts.periodFrom} – ${opts.periodTo}`) +
      detailRow('Total', opts.totalAmount)
    )}
    ${button('View Invoice', `${APP_URL}/provider/invoices`)}
  `
  return { subject: `Invoice ${opts.invoiceNumber} ready for review`, html: wrapper(content) }
}

export function providerRelationshipRequestEmail(opts: {
  recipientName: string; providerName: string; linkUrl: string
}) {
  const content = `
    ${heading('Provider Relationship Request')}
    ${paragraph(`Hi ${opts.recipientName}, ${opts.providerName} would like to establish a relationship with you on CareTime.`)}
    ${button('Approve Relationship', opts.linkUrl)}
  `
  return { subject: `${opts.providerName} wants to connect on CareTime`, html: wrapper(content) }
}

export function welcomeEmail(opts: {
  name: string; role: string; loginUrl: string
}) {
  const content = `
    ${heading('Welcome to CareTime')}
    ${paragraph(`Hi ${opts.name}, your ${opts.role} account has been created. You can now log in to CareTime.`)}
    ${button('Log In', opts.loginUrl)}
  `
  return { subject: 'Welcome to CareTime', html: wrapper(content) }
}
