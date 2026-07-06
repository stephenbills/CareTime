import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProvider } from '@/lib/api/auth'
import { sendEmail } from '@/lib/email/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'

// POST /api/invoices — generate invoices
// Body: { periodStart, periodEnd, clientId? (null = all clients) }
export async function POST(req: NextRequest) {
  try {
    const caller = await requireProvider()
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { periodStart, periodEnd, clientId } = await req.json()
    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'Period start and end dates are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get provider rates
    const { data: provider } = await admin.from('providers')
      .select('id, name, client_charge_pct, worker_pay_pct')
      .eq('id', caller.providerId).single()

    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

    const defaultClientPct = provider.client_charge_pct || 100
    const defaultWorkerPct = provider.worker_pay_pct || 62

    // Find billable activities: approved by client, not yet invoiced
    let query = admin.from('activities')
      .select('*, carers(name), clients(id, name, email), ndis_line_items(line_item_number, description, unit_price, client_charge_pct_override, worker_pay_pct_override)')
      .gte('start_time', new Date(periodStart).toISOString())
      .lte('start_time', new Date(periodEnd + 'T23:59:59').toISOString())
      .is('invoice_id', null)
      .in('status', ['awaiting_payment_approval', 'ready_for_payment'])

    if (clientId) query = query.eq('client_id', clientId)

    const { data: activities, error: actErr } = await query.order('start_time')

    if (actErr) return NextResponse.json({ error: actErr.message }, { status: 500 })
    if (!activities || activities.length === 0) {
      return NextResponse.json({ error: 'No billable activities found for this period' }, { status: 400 })
    }

    // Group activities by client
    const byClient: Record<string, any[]> = {}
    for (const act of activities) {
      const cid = act.client_id
      if (!byClient[cid]) byClient[cid] = []
      byClient[cid].push(act)
    }

    // Generate an invoice number prefix
    const datePrefix = periodStart.replace(/-/g, '').slice(2)
    let invoiceSeq = 1

    const invoiceIds: string[] = []

    for (const [cid, acts] of Object.entries(byClient)) {
      const client = (acts[0].clients as any)
      const invoiceNumber = `INV-${datePrefix}-${String(invoiceSeq++).padStart(3, '0')}`

      let totalHours = 0
      let totalAmount = 0
      let totalWorkerCost = 0
      const lineItems: any[] = []

      for (const act of acts) {
        const start = new Date(act.actual_start_time || act.start_time)
        const end = new Date(act.actual_end_time || act.end_time)
        const durationHours = Math.round((end.getTime() - start.getTime()) / 36000) / 100

        const ndis = act.ndis_line_items as any
        const unitPrice = ndis?.unit_price || 0
        const clientPct = ndis?.client_charge_pct_override ?? defaultClientPct
        const workerPct = ndis?.worker_pay_pct_override ?? defaultWorkerPct

        const chargeRate = unitPrice * clientPct / 100
        const workerRate = unitPrice * workerPct / 100
        const chargeAmount = Math.round(chargeRate * durationHours * 100) / 100
        const workerAmount = Math.round(workerRate * durationHours * 100) / 100

        totalHours += durationHours
        totalAmount += chargeAmount
        totalWorkerCost += workerAmount

        lineItems.push({
          activity_id: act.id,
          activity_title: act.title,
          activity_date: start.toISOString().slice(0, 10),
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          duration_hours: durationHours,
          worker_name: (act.carers as any)?.name || '—',
          ndis_line_item_number: ndis?.line_item_number || '—',
          ndis_description: ndis?.description || '—',
          ndis_unit_price: unitPrice,
          client_charge_pct: clientPct,
          worker_pay_pct: workerPct,
          charge_amount: chargeAmount,
          worker_amount: workerAmount,
        })
      }

      // Create invoice
      const { data: invoice, error: invErr } = await admin.from('invoices').insert({
        invoice_number: invoiceNumber,
        provider_id: caller.providerId,
        client_id: cid,
        period_start: periodStart,
        period_end: periodEnd,
        total_hours: Math.round(totalHours * 100) / 100,
        total_amount: Math.round(totalAmount * 100) / 100,
        total_worker_cost: Math.round(totalWorkerCost * 100) / 100,
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).select().single()

      if (invErr) {
        console.error('[/api/invoices] Create invoice error:', invErr.message)
        continue
      }

      // Create line items
      const itemsWithInvoice = lineItems.map(li => ({ ...li, invoice_id: invoice.id }))
      await admin.from('invoice_line_items').insert(itemsWithInvoice)

      // Mark activities as invoiced
      const activityIds = acts.map((a: any) => a.id)
      await admin.from('activities').update({ invoice_id: invoice.id }).in('id', activityIds)

      invoiceIds.push(invoice.id)

      // Email invoice to client
      if (client?.email) {
        const html = buildInvoiceEmail({
          clientName: client.name,
          providerName: provider.name,
          invoiceNumber,
          periodStart,
          periodEnd,
          lineItems,
          totalHours: Math.round(totalHours * 100) / 100,
          totalAmount: Math.round(totalAmount * 100) / 100,
          invoiceUrl: `${APP_URL}/client/dashboard`,
        })
        try {
          await sendEmail({
            to: client.email,
            subject: `Invoice ${invoiceNumber} from ${provider.name}`,
            html,
          })
          console.log('[/api/invoices] Invoice emailed to', client.email)
        } catch (emailErr: any) {
          console.warn('[/api/invoices] Email failed:', emailErr.message)
        }
      }
    }

    return NextResponse.json({
      success: true,
      invoiceCount: invoiceIds.length,
      invoiceIds,
    })
  } catch (err: any) {
    console.error('[/api/invoices] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function buildInvoiceEmail(opts: {
  clientName: string; providerName: string; invoiceNumber: string
  periodStart: string; periodEnd: string; lineItems: any[]
  totalHours: number; totalAmount: number; invoiceUrl: string
}) {
  const rows = opts.lineItems.map(li => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${formatDate(li.activity_date)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${li.activity_title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${li.worker_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#6b7280;text-align:right;">${li.duration_hours}h</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;text-align:right;font-weight:600;">$${li.charge_amount.toFixed(2)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
  <tr><td style="background:#2563eb;padding:20px 28px;">
    <span style="color:#fff;font-size:16px;font-weight:600;">CareTime</span>
  </td></tr>
  <tr><td style="padding:28px;">
    <h1 style="margin:0 0 4px;font-size:20px;color:#111827;">Invoice ${opts.invoiceNumber}</h1>
    <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">
      From ${opts.providerName} · Period: ${formatDate(opts.periodStart)} – ${formatDate(opts.periodEnd)}
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;">Hi ${opts.clientName},</p>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;">Please find your invoice details below.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr style="background:#f9fafb;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Date</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Activity</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Worker</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Hours</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Amount</th>
      </tr>
      ${rows}
      <tr style="background:#f9fafb;">
        <td colspan="3" style="padding:12px;font-size:14px;font-weight:700;color:#111827;">Total</td>
        <td style="padding:12px;text-align:right;font-size:14px;font-weight:700;color:#111827;">${opts.totalHours}h</td>
        <td style="padding:12px;text-align:right;font-size:14px;font-weight:700;color:#111827;">$${opts.totalAmount.toFixed(2)}</td>
      </tr>
    </table>
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">This is an automated invoice from CareTime.</p>
  </td></tr>
</table>
</td></tr></table></body></html>`
}
