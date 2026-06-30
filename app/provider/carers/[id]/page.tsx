'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { Field, TextArea, Section, SaveBar } from '@/components/FormFields'
import { ArrowLeft, ToggleLeft, ToggleRight, Star } from 'lucide-react'
import Link from 'next/link'

const EMPTY = {
  name: '', email: '', mobile: '', home_phone: '', work_phone: '',
  address_line1: '', suburb: '', state: '', postcode: '',
  car_registration: '', abn: '', bank_bsb: '', bank_account_number: '', comments: '',
}

function StarRating({ value }: { value: number | null }) {
  if (!value) return <span className="text-gray-400 text-sm">No ratings yet</span>
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14} className={i <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
      ))}
      <span className="text-sm text-gray-500 ml-1">{value.toFixed(1)}</span>
    </div>
  )
}

export default function CarerDetailPage() {
  const [data, setData] = useState<Record<string, string>>(EMPTY)
  const [active, setActive] = useState(true)
  const [ratings, setRatings] = useState({ client: null as number | null, provider: null as number | null })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const isNew = id === 'new'
  const supabase = createClient()

  useEffect(() => {
    if (isNew) { setLoading(false); return }
    async function load() {
      const { data: carer } = await supabase.from('carers').select('*').eq('id', id).single()
      if (carer) {
        setData({ ...EMPTY, ...Object.fromEntries(
          Object.entries(carer).map(([k, v]) => [k, v == null ? '' : String(v)])
        )})
        setActive(carer.active ?? true)
        setRatings({ client: carer.client_rating, provider: carer.provider_rating })
      }
      setLoading(false)
    }
    load()
  }, [id])

  const set = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  const f = (field: string) => ({
    value: data[field] ?? '',
    onChange: (v: string) => set(field, v),
  })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    if (isNew) {
      const { data: created, error: err } = await supabase
        .from('carers')
        .insert({ ...data, active })
        .select().single()
      if (err) { setError(err.message); setSaving(false); return }
      setSaving(false)
      if (created) router.push(`/provider/carers/${created.id}`)
    } else {
      const { error: err } = await supabase.from('carers').update({ ...data, active }).eq('id', id)
      if (err) { setError(err.message); setSaving(false); return }
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/carers" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'Add Carer' : data.name || 'Carer Details'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isNew ? 'Enter carer details below' : 'Edit carer information'}
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
            <Field label="BSB" {...f('bank_bsb')} required half />
            <Field label="Account Number" {...f('bank_account_number')} required half />
          </div>
        </Section>

        {!isNew && (
          <Section title="Ratings">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Client Rating</p>
                <StarRating value={ratings.client} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Provider Rating</p>
                <StarRating value={ratings.provider} />
              </div>
            </div>
          </Section>
        )}

        {!isNew && (
          <Section title="Account Status">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{active ? 'Active' : 'Inactive'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {active ? 'Carer can be assigned to activities' : 'Carer is deactivated and hidden from active lists'}
                </p>
              </div>
              <button type="button" onClick={() => setActive(a => !a)} className="text-gray-400 hover:text-blue-600 transition-colors">
                {active ? <ToggleRight size={36} className="text-blue-600" /> : <ToggleLeft size={36} />}
              </button>
            </div>
          </Section>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠ {error}</div>
        )}

        <SaveBar saving={saving} saved={saved} onCancel={() => router.push('/provider/carers')} />
      </form>
    </div>
  )
}
