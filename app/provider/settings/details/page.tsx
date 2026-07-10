'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Section, SaveBar } from '@/components/FormFields'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

const EMPTY = {
  name: '', abn: '', address_line1: '', address_line2: '', suburb: '', state: '', postcode: '',
  phone: '', fax: '', email: '', website: '', ceo_details: '', description: '',
  admin_percentage: '', admin_flat_fee: '', emergency_procedures: '',
  bank_name: '', bank_account_name: '', bank_bsb: '', bank_account_number: '', next_invoice_number: '1001',
  client_charge_pct: '100', worker_pay_pct: '62', gst_rate: '10', invoice_days_due: '14',
}

function toNum(val: string): number | null {
  if (val === '' || val === null || val === undefined) return null
  const n = Number(val)
  return isNaN(n) ? null : n
}
function toInt(val: string, fallback: number): number {
  const n = parseInt(val)
  return isNaN(n) ? fallback : n
}

function Field({ label, value, onChange, type = 'text', required = false, half = false, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean; half?: boolean; placeholder?: string
}) {
  return (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5"> *</span>}
      </label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function TextArea({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  )
}

export default function ProviderDetailsPage() {
  const [data, setData] = useState<Record<string, string>>(EMPTY)
  const [providerId, setProviderId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: provider } = await supabase
        .from('providers').select('*').eq('user_id', user.id).maybeSingle()
      if (provider) {
        setProviderId(provider.id)
        setData({
          name: provider.name || '',
          abn: provider.abn || '',
          address_line1: provider.address_line1 || '',
          address_line2: provider.address_line2 || '',
          suburb: provider.suburb || '',
          state: provider.state || '',
          postcode: provider.postcode || '',
          phone: provider.phone || '',
          fax: provider.fax || '',
          email: provider.email || '',
          website: provider.website || '',
          ceo_details: provider.ceo_details || '',
          description: provider.description || '',
          admin_percentage: provider.admin_percentage != null ? String(provider.admin_percentage) : '',
          admin_flat_fee: provider.admin_flat_fee != null ? String(provider.admin_flat_fee) : '',
          emergency_procedures: provider.emergency_procedures || '',
          bank_name: provider.bank_name || '',
          bank_account_name: provider.bank_account_name || '',
          bank_bsb: provider.bank_bsb || '',
          bank_account_number: provider.bank_account_number || '',
          next_invoice_number: provider.next_invoice_number != null ? String(provider.next_invoice_number) : '1001',
          client_charge_pct: provider.client_charge_pct != null ? String(provider.client_charge_pct) : '100',
          worker_pay_pct: provider.worker_pay_pct != null ? String(provider.worker_pay_pct) : '62',
          gst_rate: provider.gst_rate != null ? String(provider.gst_rate) : '10',
          invoice_days_due: provider.invoice_days_due != null ? String(provider.invoice_days_due) : '14',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  const set = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setSaving(false); return }

    const payload = {
      user_id: user.id,
      name: data.name,
      abn: data.abn,
      address_line1: data.address_line1,
      address_line2: data.address_line2 || null,
      suburb: data.suburb,
      state: data.state,
      postcode: data.postcode,
      phone: data.phone,
      fax: data.fax || null,
      email: data.email,
      website: data.website || null,
      ceo_details: data.ceo_details || null,
      description: data.description || null,
      emergency_procedures: data.emergency_procedures || null,
      bank_name: data.bank_name || null,
      bank_account_name: data.bank_account_name || null,
      bank_bsb: data.bank_bsb || null,
      bank_account_number: data.bank_account_number || null,
      admin_percentage: toNum(data.admin_percentage),
      admin_flat_fee: toNum(data.admin_flat_fee),
      next_invoice_number: toInt(data.next_invoice_number, 1001),
      client_charge_pct: toNum(data.client_charge_pct) ?? 100,
      worker_pay_pct: toNum(data.worker_pay_pct) ?? 62,
      gst_rate: toNum(data.gst_rate) ?? 10,
      invoice_days_due: toInt(data.invoice_days_due, 14),
    }

    if (providerId) {
      const { error: err } = await supabase.from('providers').update(payload).eq('id', providerId)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { data: created, error: err } = await supabase
        .from('providers').insert(payload).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      if (created) setProviderId(created.id)
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const f = (field: string) => ({ value: data[field] ?? '', onChange: (v: string) => set(field, v) })

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/settings" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provider Details</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your organisation and billing information</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Organisation Details">
          <p className="text-xs text-gray-400 mb-3">Fields marked <span className="text-red-500">*</span> are required</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider Name" {...f('name')} required half />
            <Field label="ABN Number" {...f('abn')} required half />
            <Field label="Address Line 1" {...f('address_line1')} required />
            <Field label="Address Line 2" {...f('address_line2')} placeholder="Optional" />
            <Field label="Suburb" {...f('suburb')} required half />
            <Field label="State" {...f('state')} required half />
            <Field label="Postcode" {...f('postcode')} half />
            <Field label="Phone" {...f('phone')} required half />
            <Field label="Fax" {...f('fax')} half placeholder="Optional" />
            <Field label="Email Address" {...f('email')} type="email" required half />
            <Field label="Web Site Address" {...f('website')} half placeholder="Optional" />
            <Field label="CEO Details" {...f('ceo_details')} placeholder="Optional" />
            <TextArea label="Description of Provider and its services" {...f('description')} />
            <TextArea label="Emergency Contact Procedures" {...f('emergency_procedures')} />
          </div>
        </Section>

        <Section title="Administration Fees">
          <p className="text-xs text-gray-400 mb-3">Leave blank if not applicable</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Administration Percentage (%)" {...f('admin_percentage')} type="number" half placeholder="e.g. 5" />
            <Field label="Administration Flat Fee ($)" {...f('admin_flat_fee')} type="number" half placeholder="e.g. 10.00" />
          </div>
        </Section>

        <Section title="Billing Rates">
          <p className="text-xs text-gray-400 mb-3">
            Used to price every Activity: each NDIS line item's unit price × Client Charge % is
            what the Client is billed; × Worker Pay % is what the Worker is paid. Either can be
            overridden per NDIS line item in NDIS Line Items settings.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client Charge (%)" {...f('client_charge_pct')} type="number" half placeholder="e.g. 100" />
            <Field label="Worker Pay (%)" {...f('worker_pay_pct')} type="number" half placeholder="e.g. 62" />
          </div>
        </Section>

        <Section title="Bank Details for Invoicing">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bank Name" {...f('bank_name')} half placeholder="e.g. Commonwealth Bank" />
            <Field label="Account Name" {...f('bank_account_name')} required half />
            <Field label="BSB" {...f('bank_bsb')} required half placeholder="e.g. 062-000" />
            <Field label="Account Number" {...f('bank_account_number')} required half />
          </div>
        </Section>

        <Section title="Invoice Settings">
          <div className="grid grid-cols-2 gap-4">
            <Field label="GST Rate (%)" {...f('gst_rate')} type="number" half placeholder="e.g. 10" />
            <Field label="Payment Due (days)" {...f('invoice_days_due')} type="number" half placeholder="e.g. 14" />
            <Field label="Next Invoice Number" {...f('next_invoice_number')} required half placeholder="e.g. 1001" />
          </div>
        </Section>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠ {error}</div>}
        <SaveBar saving={saving} saved={saved} onCancel={() => {}} />
      </form>
    </div>
  )
}
