'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Section, SaveBar } from '@/components/FormFields'

const EMPTY = {
  name: '', abn: '', address_line1: '', address_line2: '', suburb: '', state: '', postcode: '',
  phone: '', fax: '', email: '', website: '', ceo_details: '', description: '',
  admin_percentage: '', admin_flat_fee: '', emergency_procedures: '',
  bank_account_name: '', bank_bsb: '', bank_account_number: '', next_invoice_number: '1001',
}

// Fields that must be valid numbers if non-empty
const NUMERIC_FIELDS: Record<string, string> = {
  admin_percentage: 'Administration Percentage',
  admin_flat_fee: 'Administration Flat Fee',
  next_invoice_number: 'Next Invoice Number',
}

function Field({
  label, value, onChange, type = 'text',
  required = false, half = false, placeholder = ''
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  half?: boolean
  placeholder?: string
}) {
  return (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function TextArea({
  label, value, onChange, rows = 3
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  )
}

export default function SettingsPage() {
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
          ...EMPTY,
          ...Object.fromEntries(
            Object.entries(provider).map(([k, v]) => [k, v == null ? '' : String(v)])
          )
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  const set = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  function validate(): string {
    // Check numeric fields
    for (const [field, label] of Object.entries(NUMERIC_FIELDS)) {
      const val = data[field]
      if (val !== '' && isNaN(Number(val))) {
        return `"${label}" must be a number (you entered: "${val}")`
      }
    }
    return ''
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setSaving(false); return }

    const payload = {
      ...data,
      user_id: user.id,
      admin_percentage: data.admin_percentage === '' ? null : Number(data.admin_percentage),
      admin_flat_fee: data.admin_flat_fee === '' ? null : Number(data.admin_flat_fee),
      next_invoice_number: data.next_invoice_number === '' ? 1001 : parseInt(data.next_invoice_number),
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

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const f = (field: string) => ({
    value: data[field] ?? '',
    onChange: (v: string) => set(field, v),
  })

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Provider Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage your organisation details and billing information
        </p>
        <p className="text-xs text-gray-400 mt-1">Fields marked <span className="text-red-500">*</span> are required</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Organisation Details">
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

        <Section title="Bank Details for Invoicing">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Account Name" {...f('bank_account_name')} required />
            <Field label="BSB" {...f('bank_bsb')} required half placeholder="e.g. 062-000" />
            <Field label="Account Number" {...f('bank_account_number')} required half />
            <Field label="Next Invoice Number" {...f('next_invoice_number')} required half placeholder="e.g. 1001" />
          </div>
        </Section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            ⚠ {error}
          </div>
        )}

        <SaveBar saving={saving} saved={saved} onCancel={() => {}} />
      </form>
    </div>
  )
}
