'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ChevronLeft, CalendarDays } from 'lucide-react'
import Link from 'next/link'

type Holiday = { id: string; name: string; date: string }

// Pre-populate common Australian public holidays for convenience
const COMMON_HOLIDAYS_2026 = [
  { name: "New Year's Day", date: '2026-01-01' },
  { name: 'Australia Day', date: '2026-01-26' },
  { name: 'Good Friday', date: '2026-04-03' },
  { name: 'Easter Saturday', date: '2026-04-04' },
  { name: 'Easter Monday', date: '2026-04-06' },
  { name: 'Anzac Day', date: '2026-04-25' },
  { name: 'Christmas Day', date: '2026-12-25' },
  { name: 'Boxing Day', date: '2026-12-28' },
]

const COMMON_HOLIDAYS_2027 = [
  { name: "New Year's Day", date: '2027-01-01' },
  { name: 'Australia Day', date: '2027-01-26' },
  { name: 'Good Friday', date: '2027-03-26' },
  { name: 'Easter Saturday', date: '2027-03-27' },
  { name: 'Easter Monday', date: '2027-03-29' },
  { name: 'Anzac Day', date: '2027-04-25' },
  { name: 'Christmas Day', date: '2027-12-25' },
  { name: 'Boxing Day', date: '2027-12-27' },
]

export default function PublicHolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [providerId, setProviderId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const supabase = createClient()

  async function loadHolidays() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: provider } = await supabase
      .from('providers').select('id').eq('user_id', user.id).maybeSingle()
    if (!provider) { setLoading(false); return }
    setProviderId(provider.id)
    const { data } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('provider_id', provider.id)
      .order('date')
    setHolidays(data || [])
    setLoading(false)
  }

  useEffect(() => { loadHolidays() }, [])

  async function handleAdd() {
    setError('')
    if (!newName.trim()) { setError('Holiday name is required'); return }
    if (!newDate) { setError('Date is required'); return }
    // Check for duplicate
    if (holidays.some(h => h.date === newDate && h.name === newName.trim())) {
      setError('This holiday already exists'); return
    }
    setSaving(true)
    const { error: err } = await supabase.from('public_holidays').insert({
      provider_id: providerId,
      name: newName.trim(),
      date: newDate,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setNewName('')
    setNewDate('')
    setSaving(false)
    loadHolidays()
  }

  async function handleDelete(id: string) {
    const { error: err } = await supabase.from('public_holidays').delete().eq('id', id)
    if (err) setError(err.message)
    setDeleteId(null)
    loadHolidays()
  }

  async function importYear(year: number) {
    setImporting(true)
    const list = year === 2026 ? COMMON_HOLIDAYS_2026 : COMMON_HOLIDAYS_2027
    // Only import ones not already present
    const existing = new Set(holidays.map(h => h.date))
    const toInsert = list
      .filter(h => !existing.has(h.date))
      .map(h => ({ ...h, provider_id: providerId }))
    if (toInsert.length > 0) {
      const { error: err } = await supabase.from('public_holidays').insert(toInsert)
      if (err) setError(err.message)
    }
    setImporting(false)
    loadHolidays()
  }

  // Group holidays by year
  const grouped = holidays.reduce((acc, h) => {
    const year = h.date.slice(0, 4)
    if (!acc[year]) acc[year] = []
    acc[year].push(h)
    return acc
  }, {} as Record<string, Holiday[]>)

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
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

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/settings" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Public Holidays</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Holidays defined here trigger the public holiday billing rate
          </p>
        </div>
      </div>

      {/* Quick import */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <CalendarDays size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">Quick import Australian public holidays</p>
            <p className="text-xs text-blue-600 mt-0.5 mb-3">Imports standard national holidays — add state-specific ones manually</p>
            <div className="flex gap-2">
              <button onClick={() => importYear(2026)} disabled={importing}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {importing ? 'Importing…' : 'Import 2026'}
              </button>
              <button onClick={() => importYear(2027)} disabled={importing}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {importing ? 'Importing…' : 'Import 2027'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add new holiday */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Add Holiday</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Holiday Name <span className="text-red-500">*</span>
            </label>
            <input type="text" value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. Queen's Birthday"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input type="date" value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {error && (
          <p className="text-red-600 text-sm mt-2">⚠ {error}</p>
        )}
        <button onClick={handleAdd} disabled={saving}
          className="mt-3 flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          <Plus size={14} /> {saving ? 'Adding…' : 'Add Holiday'}
        </button>
      </div>

      {/* Holiday list grouped by year */}
      {holidays.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">No public holidays defined yet.</p>
          <p className="text-gray-400 text-xs mt-1">Use the quick import above or add them manually.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([year, yearHolidays]) => (
            <div key={year} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{year}</h3>
              </div>
              <ul className="divide-y divide-gray-50">
                {yearHolidays.map(h => (
                  <li key={h.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{h.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(h.date)}</p>
                    </div>
                    <button onClick={() => setDeleteId(h.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-gray-400">{holidays.length} holiday{holidays.length !== 1 ? 's' : ''} defined</p>
        </div>
      )}

      {/* Delete modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Remove holiday?</h3>
            <p className="text-sm text-gray-500 mb-5">This will remove it from your public holiday list.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                Remove
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
