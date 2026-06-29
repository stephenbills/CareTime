'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

function Field({ label, defaultValue, onBlur, type = 'text', required = false, half = false }: {
  label: string
  defaultValue: string
  onBlur: (value: string) => void
  type?: string
  required?: boolean
  half?: boolean
}) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    setValue(defaultValue)
  }, [defaultValue])

  return (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={e => onBlur(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function TextArea({ label, defaultValue, onBlur }: {
  label: string
  defaultValue: string
  onBlur: (value: string) => void
}) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    setValue(defaultValue)
  }, [defaultValue])

  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={e => onBlur(e.target.value)}
        rows={3}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

const EMPTY = {
  name: '', abn: '', address_line1: '', address_line2: '', suburb: '', state: '', postcode: '',
  phone: '', fax: '', email: '', website: '', ceo_details: '', description: '',
  admin_percentage: '', admin_flat_fee: '', emergency_procedures: '',
  bank_account_name: '', bank_bsb: '', bank_account_number: '', next_invoice_number: '1001',
}

export default function SettingsPage() {
  const [data, setData] = useState<Record<string, string>>(EMPTY)
  const [providerId, setProviderId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: provider } = await supabase
        .from('providers').select('*').eq('user_id', user.id).single()
      if (provider) {
        setData({ ...EMPTY, ...Object.fromEntries(
          Object.entries(provider).map(([k, v]) => [k, v == null ? '' : String(v)])
        )})
        setProviderId(provider.id)
      }
    }
    load()
  }, [])

  const updateField = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (providerId) {
      await supabase.from('providers').update(data).eq('id', providerId)
    } else {
      const { data: created } = await supabase
        .from('providers').insert({ ...data, user_id: user.id }).select().single()
      if (created) setProviderId(created.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const f = (field: string) => ({
    defaultValue: data[field] ?? '',
    onBlur: (v: string) => updateField(field, v),
  })

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Provider Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your organisation details and billing information</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Organisation Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider Name" {...f('name')} required half />
            <Field label="ABN Number" {...f('abn')} required half />
            <Field label="Address Line 1" {...f('address_line1')} required />
            <Field label="Address Line 2 (Optional)" {...f('address_line2')} />
            <Field label="Suburb" {...f('suburb')} required half />
            <Field label="State" {...f('state')} required half />
            <Field label="Postcode" {...f('postcode')} half />
            <Field label="Phone" {...f('phone')} required half />
            <Field label="Fax" {...f('fax')} half />
            <Field label="Email Address" {...f('email')} type="email" required half />
            <Field label="Web Site Address" {...f('website')} half />
            <Field label="CEO Details" {...f('ceo_details')} />
            <TextArea label="Description of Provider and its services" {...f('description')} />
            <TextArea label="Emergency Contact Procedures" {...f('emergency_procedures')} />
          </div>
        </Section>

        <Section title="Administration Fees">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Administration Percentage (%)" {...f('admin_percentage')} type="number" half />
            <Field label="Administration Flat Fee ($)" {...f('admin_flat_fee')} type="number" half />
          </div>
        </Section>

        <Section title="Bank Details for Invoicing">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Account Name" {...f('bank_account_name')} required />
            <Field label="BSB" {...f('bank_bsb')} required half />
            <Field label="Account Number" {...f('bank_account_number')} required half />
            <Field label="Next Invoice Number" {...f('next_invoice_number')} required half />
          </div>
        </Section>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-green-600 text-sm">Saved successfully</span>}
        </div>
      </form>
    </div>
  )
}
