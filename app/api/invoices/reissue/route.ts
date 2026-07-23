import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProvider } from '@/lib/api/auth'

// POST /api/invoices/reissue — void this Provider's already-invoiced
// (non-paid) invoices for a Client that overlap a date range, unlinking
// their activities so they can be regenerated fresh via POST /api/invoices.
// Body: { periodStart, periodEnd, clientId }
export async function POST(req: NextRequest) {
  try {
    const caller = await requireProvider()
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!caller.providerId) {
      return NextResponse.json({ error: 'A Provider account is required to reissue invoices' }, { status: 403 })
    }

    const { periodStart, periodEnd, clientId } = await req.json()
    if (!periodStart || !periodEnd || !clientId) {
      return NextResponse.json({ error: 'Period start, end, and client are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Find this Provider's invoices for this Client that overlap the range,
    // excluding already-paid invoices — not safe to unwind a settled invoice.
    const { data: invoices, error: invErr } = await admin.from('invoices')
      .select('id, status')
      .eq('provider_id', caller.providerId)
      .eq('client_id', clientId)
      .neq('status', 'paid')
      .lte('period_start', periodEnd)
      .gte('period_end', periodStart)

    if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })
    if (!invoices || invoices.length === 0) {
      return NextResponse.json({ voidedCount: 0 })
    }

    const invoiceIds = invoices.map(i => i.id)

    await admin.from('invoice_line_items').delete().in('invoice_id', invoiceIds)
    await admin.from('activities').update({ invoice_id: null }).in('invoice_id', invoiceIds)
    await admin.from('invoices').delete().in('id', invoiceIds)

    return NextResponse.json({ voidedCount: invoiceIds.length })
  } catch (err: any) {
    console.error('[/api/invoices/reissue] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
