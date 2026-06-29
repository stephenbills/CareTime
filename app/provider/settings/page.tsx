'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Field, TextArea, Section, SaveBar } from '@/components/FormFields'

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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: provider, error: err } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

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

  const updateField = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  const f = (field: string) => ({
    defaultValue: data[field] ?? '',
    onBlur: (v: string) => updateField(field, v),
  })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setSaving(false); return }

    // Clean numeric fields — empty string → null
    const payload = {
      ...data,
      user_id: user.id,
      admin_percentage: data.admin_percentage === '' ? null : data.admin_percentage,
      admin_flat_fee: data.admin_flat_fee === '' ? null : data.admin_flat_fee,
      next_invoice_number: data.next_invoice_number === '' ? 1001 : parseInt(data.next_invoice_number),
    }

    if (providerId) {
      const { error: err } = await supabase
        .from('providers')
        .update(payload)
        .eq('id', providerId)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { data: created, error: err } = await supabase
        .from('providers')
        .insert(payload)
        .select()
        .single()
      if (err) { setError(err.message); setSaving(false); return }
      if (created) setProviderId(created.id)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Provider Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage your organisation details and billing information
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Organisation Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider Name" {...f('name')} required half />
            <Field label="ABN Number" {...f('abn')} required half />
            <Field label="Address Line 1" {...f('address_line1')} />
            <Field label="Address Line 2 (Optional)" {...f('address_line2')} />
            <Field label="Suburb" {...f('suburb')} half />
            <Field label="State" {...f('state')} half />
            <Field label="Postcode" {...f('postcode')} half />
            <Field label="Phone" {...f('phone')} half />
            <Field label="Fax" {...f('fax')} half />
            <Field label="Email Address" {...f('email')} type="email" half />
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
            <Field label="Account Name" {...f('bank_account_name')} />
            <Field label="BSB" {...f('bank_bsb')} half />
            <Field label="Account Number" {...f('bank_account_number')} half />
            <Field label="Next Invoice Number" {...f('next_invoice_number')} half />
          </div>
        </Section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <SaveBar saving={saving} saved={saved} onCancel={() => {}} />
      </form>
    </div>
  )
}
