'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Field, TextArea, Section, SaveBar } from '@/components/FormFields'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const EMPTY = {
  name: '', email: '', mobile: '', home_phone: '', work_phone: '',
  address_line1: '', suburb: '', state: '', postcode: '',
  car_registration: '', abn: '', bank_bsb: '', bank_account_number: '', comments: '',
}

export default function NewCarerPage() {
  const [data, setData] = useState<Record<string, string>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const set = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  const f = (field: string) => ({ value: data[field] ?? '', onChange: (v: string) => set(field, v) })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!data.email.trim()) { setError('Email is required to send the invitation'); return }
    setSaving(true)
    setError('')

    const payload = {
      name: data.name, email: data.email || null, mobile: data.mobile || null,
      home_phone: data.home_phone || null, work_phone: data.work_phone || null,
      address_line1: data.address_line1 || null, suburb: data.suburb || null,
      state: data.state || null, postcode: data.postcode || null,
      car_registration: data.car_registration || null, abn: data.abn || null,
      bank_bsb: data.bank_bsb || null, bank_account_number: data.bank_account_number || null,
      comments: data.comments || null, active: true,
    }

    const { data: created, error: err } = await supabase
      .from('carers').insert(payload).select().single()
    if (err) { setError(err.message); setSaving(false); return }

    // Send Supabase invite email
    const inviteRes = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email, name: data.name, role: 'worker', recordId: created.id }),
    })
    const inviteData = await inviteRes.json()
    if (!inviteRes.ok) {
      // Don't block — worker is saved, just warn about invite
      console.warn('Invite failed:', inviteData.error)
    }

    setSaving(false)
    router.push(`/provider/carers/${created.id}`)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/carers" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Worker</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            An invitation email will be sent to the worker to set their password
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Personal Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name" {...f('name')} required half />
            <Field label="Email Address" {...f('email')} type="email" required half />
            <Field label="Mobile Phone" {...f('mobile')} required half />
            <Field label="Home Phone" {...f('home_phone')} half />
            <Field label="Work Phone" {...f('work_phone')} half />
            <Field label="Car Registration" {...f('car_registration')} half />
            <div className="col-span-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Address</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Address Line 1" {...f('address_line1')} />
                <Field label="Suburb" {...f('suburb')} half />
                <Field label="State" {...f('state')} half />
                <Field label="Postcode" {...f('postcode')} half />
              </div>
            </div>
            <TextArea label="Comments" {...f('comments')} />
          </div>
        </Section>
        <Section title="Payment Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="ABN (Optional)" {...f('abn')} half />
            <div className="col-span-1" />
            <Field label="BSB" {...f('bank_bsb')} half />
            <Field label="Account Number" {...f('bank_account_number')} half />
          </div>
        </Section>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠ {error}</div>
        )}
        <SaveBar saving={saving} saved={false} onCancel={() => router.push('/provider/carers')} />
      </form>
    </div>
  )
}
