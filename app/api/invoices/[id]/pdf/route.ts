import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProvider } from '@/lib/api/auth'
import { generateInvoicePdf } from '@/lib/invoice/pdf'

// GET /api/invoices/[id]/pdf — regenerate the exact same PDF that was
// emailed to the Client, on demand, for the Provider's own "Print"/"Download"
// button. Never renders the on-screen dashboard view (which shows Worker
// Cost/Margin) — this is the client-safe formal invoice only.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await requireProvider()
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!caller.providerId) {
      return NextResponse.json({ error: 'A Provider account is required' }, { status: 403 })
    }

    const { id } = await params
    const admin = createAdminClient()

    // SECURITY: scoped to the caller's own provider — an invoice id alone
    // must not be enough to fetch someone else's invoice.
    const { data: invoice } = await admin.from('invoices')
      .select('*')
      .eq('id', id)
      .eq('provider_id', caller.providerId)
      .maybeSingle()

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const [{ data: lineItems }, { data: provider }, { data: client }] = await Promise.all([
      admin.from('invoice_line_items').select('*').eq('invoice_id', id).order('activity_date'),
      admin.from('providers')
        .select('name, address_line1, suburb, state, postcode, abn, gst_rate, invoice_days_due, bank_name, bank_account_name, bank_bsb, bank_account_number')
        .eq('id', invoice.provider_id).single(),
      admin.from('clients')
        .select('name, email, address_line1, address_line2, suburb, state, postcode')
        .eq('id', invoice.client_id).single(),
    ])

    if (!provider || !client) {
      return NextResponse.json({ error: 'Invoice is missing provider or client data' }, { status: 500 })
    }

    const daysDue = provider.invoice_days_due ?? 14
    const dueDate = invoice.sent_at
      ? new Date(new Date(invoice.sent_at).getTime() + daysDue * 86400000).toISOString()
      : undefined

    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: invoice.invoice_number,
      providerName: provider.name,
      providerAddress: [provider.address_line1, provider.suburb, provider.state, provider.postcode].filter(Boolean).join(', ') || undefined,
      providerAbn: provider.abn || undefined,
      clientName: client.name,
      clientAddress: [client.address_line1, client.address_line2, client.suburb, client.state, client.postcode].filter(Boolean).join(', ') || undefined,
      clientEmail: client.email || undefined,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      lineItems: (lineItems || []).map((li: any) => ({
        activity_date: li.activity_date,
        activity_title: li.activity_title,
        worker_name: li.worker_name,
        start_time: li.start_time,
        end_time: li.end_time,
        duration_hours: li.duration_hours,
        ndis_line_item_number: li.ndis_line_item_number,
        ndis_description: li.ndis_description,
        charge_amount: li.charge_amount,
      })),
      totalHours: invoice.total_hours,
      subtotalAmount: invoice.subtotal_amount,
      gstRate: provider.gst_rate ?? 10,
      gstAmount: invoice.gst_amount,
      totalAmount: invoice.total_amount,
      totalWorkerCost: invoice.total_worker_cost,
      sentDate: invoice.sent_at,
      dueDate,
      bankName: provider.bank_name || undefined,
      bankAccountName: provider.bank_account_name || undefined,
      bankBsb: provider.bank_bsb || undefined,
      bankAccountNumber: provider.bank_account_number || undefined,
    })

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('[/api/invoices/[id]/pdf] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
