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
  const router = useRouter()
  const supabase = createClient()

  const updateField = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  const f = (field: string) => ({
    value: data[field] ?? '',
    onChange: (v: string) => updateField(field, v),
  })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: created } = await supabase
      .from('carers').insert({ ...data, active: true }).select().single()
    setSaving(false)
    if (created) router.push(`/provider/carers/${created.id}`)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/carers" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Carer</h1>
          <p className="text-gray-500 text-sm mt-0.5">Enter the new carer's details below</p>
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
            <Field label="BSB" {...f('bank_bsb')} required half />
            <Field label="Account Number" {...f('bank_account_number')} required half />
          </div>
        </Section>

        <SaveBar saving={saving} saved={false} onCancel={() => router.push('/provider/carers')} />
      </form>
    </div>
  )
}
