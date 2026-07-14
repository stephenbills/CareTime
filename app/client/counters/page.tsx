'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Trash2, Plus } from 'lucide-react'

type Counter = {
  id: string
  title: string
  active: boolean
}

export default function CountersPage() {
  const [clientId, setClientId] = useState<string | null>(null)
  const [items, setItems] = useState<Counter[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: client } = await supabase
      .from('clients').select('id').eq('user_id', user.id).maybeSingle()
    if (!client) { setLoading(false); return }
    setClientId(client.id)

    const { data } = await supabase
      .from('client_counters').select('*')
      .eq('client_id', client.id).eq('active', true)
      .order('title')
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startAdd() {
    setTitle('')
    setError('')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    if (!clientId) return
    setSaving(true)

    const { error: err } = await supabase.from('client_counters')
      .insert({ client_id: clientId, title: title.trim() })
    if (err) {
      setError(err.code === '23505' ? 'You already have a counter with this title' : err.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setShowForm(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this Counter? Its recorded values on past Activities will be removed.')) return
    await supabase.from('client_counters').delete().eq('id', id)
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-gray-400 text-sm">Loading…</div>
    </div>
  )

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center gap-3 pt-1 mb-5">
        <Link href="/client/details" className="p-1 text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Counters</h1>
          <p className="text-gray-400 text-xs mt-0.5">Your Worker tallies these on every shift</p>
        </div>
      </div>

      <div className="space-y-3 mb-5">
        {items.length === 0 && !showForm && (
          <p className="text-sm text-gray-400 text-center py-6">No Counters yet.</p>
        )}
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">{item.title}</p>
            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Add Counter</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value.slice(0, 30))}
              maxLength={30}
              placeholder="e.g. Meals refused"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-[11px] text-gray-300 mt-1">{title.length}/30</p>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">⚠ {error}</div>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 active:bg-blue-700 transition-colors">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-5 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={startAdd}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 text-gray-500 py-3 rounded-2xl text-sm font-medium hover:border-blue-300 hover:text-blue-600 transition-colors">
          <Plus size={16} /> Add Counter
        </button>
      )}
    </div>
  )
}
