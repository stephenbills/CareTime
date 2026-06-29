'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, X, Check, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const EMPTY_FORM = {
  name: '',
  rate_per_hour: '',
  days: [] as string[],
  start_time: '08:00',
  end_time: '18:00',
  is_public_holiday: false,
}

type Rate = {
  id: string
  name: string
  rate_per_hour: number
  days: string[]
  start_time: string
  end_time: string
  is_public_holiday: boolean
}

export default function BillingRatesPage() {
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [providerId, setProviderId] = useState<string | null>(null)
  const supabase = createClient()

  async function loadRates() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: provider } = await supabase
      .from('providers').select('id').eq('user_id', user.id).maybeSingle()
    if (!provider) { setLoading(false); return }
    setProviderId(provider.id)
    const { data } = await supabase
      .from('billing_rates')
      .select('*')
      .eq('provider_id', provider.id)
      .order('name')
    setRates(data || [])
    setLoading(false)
  }

  useEffect(() => { loadRates() }, [])

  function openNew() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setError('')
    setShowForm(true)
  }

  function openEdit(rate: Rate) {
    setForm({
      name: rate.name,
      rate_per_hour: String(rate.rate_per_hour),
      days: rate.days || [],
      start_time: rate.start_time?.slice(0, 5) || '08:00',
      end_time: rate.end_time?.slice(0, 5) || '18:00',
      is_public_holiday: rate.is_public_holiday || false,
    })
    setEditingId(rate.id)
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  function toggleDay(day: string) {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day]
    }))
  }

  function validate(): string {
    if (!form.name.trim()) return 'Rate name is required'
    if (!form.rate_per_hour) return 'Rate per hour is required'
    const r = Number(form.rate_per_hour)
    if (isNaN(r) || r < 0) return 'Rate per hour must be a valid positive number'
    if (form.days.length === 0 && !form.is_public_holiday) return 'Select at least one day'
    if (!form.start_time) return 'Start time is required'
    if (!form.end_time) return 'End time is required'
    if (form.start_time >= form.end_time) return 'End time must be after start time'
    return ''
  }

  async function handleSave() {
    setError('')
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)

    const payload = {
      provider_id: providerId,
      name: form.name.trim(),
      rate_per_hour: Number(form.rate_per_hour),
      days: form.is_public_holiday ? [] : form.days,
      start_time: form.start_time,
      end_time: form.end_time,
      is_public_holiday: form.is_public_holiday,
    }

    if (editingId) {
      const { error: err } = await supabase.from('billing_rates').update(payload).eq('id', editingId)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('billing_rates').insert(payload)
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    closeForm()
    loadRates()
  }

  async function handleDelete(id: string) {
    await supabase.from('billing_rates').delete().eq('id', id)
    setDeleteId(null)
    loadRates()
  }

  function formatTime(t: string) {
    if (!t) return '—'
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  if (!providerId) return (
    <div className="p-8">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
        Please save your Provider Settings first.{' '}
        <Link href="/provider/settings" className="underline font-medium">Go to Settings</Link>
      </div>
    </div>
  )

  const standardRates = rates.filter(r => !r.is_public_holiday)
  const holidayRates = rates.filter(r => r.is_public_holiday)

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/settings" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Billing Rates</h1>
          <p className="text-gray-500 text-sm mt-0.5">Set hourly rates for standard days and public holidays</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={15} /> Add Rate
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{editingId ? 'Edit Rate' : 'New Rate'}</h2>
            <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Standard Weekday"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate per Hour ($) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" step="0.01" min="0" value={form.rate_per_hour}
                    onChange={e => setForm(f => ({ ...f, rate_per_hour: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Public holiday toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.is_public_holiday}
                onChange={e => setForm(f => ({ ...f, is_public_holiday: e.target.checked, days: [] }))}
                className="rounded" />
              <span className="text-sm text-gray-700">This is a Public Holiday rate (applies to all defined public holidays)</span>
            </label>

            {/* Days — only show if not public holiday */}
            {!form.is_public_holiday && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Applicable Days <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        form.days.includes(day)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Times */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time <span className="text-red-500">*</span></label>
                <input type="time" value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time <span className="text-red-500">*</span></label>
                <input type="time" value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">⚠ {error}</div>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <Check size={14} /> {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Rate'}
            </button>
            <button onClick={closeForm}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {rates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm mb-3">No billing rates defined yet.</p>
          <button onClick={openNew} className="text-blue-600 text-sm font-medium hover:text-blue-700">
            Add your first rate →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Standard rates */}
          {standardRates.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Standard Rates</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {standardRates.map(rate => (
                  <div key={rate.id} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{rate.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {rate.days?.join(', ') || '—'} · {formatTime(rate.start_time)} – {formatTime(rate.end_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-gray-900">
                        ${Number(rate.rate_per_hour).toFixed(2)}/hr
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(rate)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteId(rate.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Public holiday rates */}
          {holidayRates.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
                <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Public Holiday Rates</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {holidayRates.map(rate => (
                  <div key={rate.id} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{rate.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        All public holidays · {formatTime(rate.start_time)} – {formatTime(rate.end_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-gray-900">
                        ${Number(rate.rate_per_hour).toFixed(2)}/hr
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(rate)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteId(rate.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Delete billing rate?</h3>
            <p className="text-sm text-gray-500 mb-5">This will permanently delete this rate.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                Delete
              </button>
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-200 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
