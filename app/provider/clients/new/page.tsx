'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Field, TextArea, Section, SaveBar } from '@/components/FormFields'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const EMPTY = {
  name: '', email: '', phone: '', mobile: '',
  address_line1: '', address_line2: '', suburb: '', state: '', postcode: '',
  ndis_number: '', comments: '',
}

export default function NewClientPage() {
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
    const { data: { user } } = await supabase.auth.getUser()
    const { data: provider } = await supabase
      .from('providers').select('id').eq('user_id', user!.id).single()
    const { data: created } = await supabase
      .from('clients')
      .insert({ ...data, active: true, provider_id: provider?.id })
      .select().single()
    setSaving(false)
    if (created) router.push(`/provider/clients/${created.id}`)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/clients" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Client</h1>
          <p className="text-gray-500 text-sm mt-0.5">Enter the new client's details below</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Client Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client Name" {...f('name')} required half />
            <Field label="NDIS Number" {...f('ndis_number')} required half />
            <Field label="Email Address" {...f('email')} type="email" required half />
            <Field label="Mobile Phone" {...f('mobile')} required half />
            <Field label="Home Phone" {...f('phone')} half />
            <div className="col-span-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Address</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Address Line 1" {...f('address_line1')} />
                <Field label="Address Line 2 (Optional)" {...f('address_line2')} />
                <Field label="Suburb" {...f('suburb')} half />
                <Field label="State" {...f('state')} half />
                <Field label="Postcode" {...f('postcode')} half />
              </div>
            </div>
            <TextArea label="Comments" {...f('comments')} />
          </div>
        </Section>
        <SaveBar saving={saving} saved={false} onCancel={() => router.push('/provider/clients')} />
      </form>
    </div>
  )
}
