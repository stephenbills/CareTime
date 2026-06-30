'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, X, Check, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

const SUPPORT_CATEGORIES = [
  'Daily Activities', 'Transport', 'Consumables',
  'Assistance with Social & Community Participation', 'Assistive Technology',
  'Home Modifications', 'Support Coordination', 'Improved Living Arrangements',
  'Increased Social & Community Participation', 'Finding & Keeping a Job',
  'Improved Health & Wellbeing', 'Improved Learning', 'Improved Life Choices',
  'Improved Daily Living', 'Improved Relationships',
]

const EMPTY_FORM = { line_item_number: '', description: '', support_category: '', unit_price: '' }

type MasterItem = {
  id: string
  line_item_number: string
  description: string
  support_category: string
  unit_price: number
  active: boolean
}

export default function NdisMasterPage() {
  const [items, setItems] = useState<MasterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const supabase = createClient()

  async function loadItems() {
    const { data } = await supabase.from('ndis_master_items').select('*').order('line_item_number')
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [])

  function openNew() { setForm(EMPTY_FORM); setEditingId(null); setError(''); setShowForm(true) }
  function openEdit(item: MasterItem) {
    setForm({
      line_item_number: item.line_item_number,
      description: item.description,
      support_category: item.support_category || '',
      unit_price: String(item.unit_price),
    })
    setEditingId(item.id); setError(''); setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setError('') }

  function validate(): string {
    if (!form.line_item_number.trim()) return 'Line item number is required'
    if (!form.description.trim()) return 'Description is required'
    if (!form.unit_price) return 'Unit price is required'
    const price = Number(form.unit_price)
    if (isNaN(price) || price < 0) return 'Unit price must be a valid positive number'
    return ''
  }

  async function handleSave() {
    setError('')
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)

    const payload = {
      line_item_number: form.line_item_number.trim(),
      description: form.description.trim(),
      support_category: form.support_category || null,
      unit_price: Number(form.unit_price),
      active: true,
    }

    if (editingId) {
      const { error: err } = await supabase.from('ndis_master_items').update(payload).eq('id', editingId)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('ndis_master_items').insert(payload)
      if (err) {
        setError(err.message.includes('duplicate') ? 'A line item with this number already exists' : err.message)
        setSaving(false); return
      }
    }
    setSaving(false); closeForm(); loadItems()
  }

  async function handleToggleActive(item: MasterItem) {
    await supabase.from('ndis_master_items').update({ active: !item.active }).eq('id', item.id)
    loadItems()
  }

  async function handleDelete(id: string) {
    await supabase.from('ndis_master_items').delete().eq('id', id)
    setDeleteId(null)
    loadItems()
  }

  const visible = items
    .filter(i => showInactive ? true : i.active)
    .filter(i =>
      !search ||
      i.line_item_number.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase())
    )

  const grouped = visible.reduce((acc, item) => {
    const cat = item.support_category || 'Uncategorised'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, MasterItem[]>)

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">NDIS Master Catalogue</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Maintained centrally. Providers select from this list to build their own catalogue.
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          <Plus size={15} /> Add Item
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by line item number or description…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          Show inactive
        </label>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-900 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{editingId ? 'Edit Master Item' : 'New Master Item'}</h2>
            <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Line Item Number <span className="text-red-500">*</span></label>
              <input type="text" value={form.line_item_number}
                onChange={e => setForm(f => ({ ...f, line_item_number: e.target.value }))}
                placeholder="e.g. 01_011_0107_1_1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price ($ per hour) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" min="0" value={form.unit_price}
                  onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
              <input type="text" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Assistance With Self-Care Activities - Standard - Weekday Daytime"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Support Category</label>
              <select value={form.support_category}
                onChange={e => setForm(f => ({ ...f, support_category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">— Select category —</option>
                {SUPPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {error && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">⚠ {error}</div>}
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
              <Check size={14} /> {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Item'}
            </button>
            <button onClick={closeForm} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm mb-3">No master items {search ? 'match your search' : 'yet'}.</p>
          {!search && (
            <button onClick={openNew} className="text-gray-900 text-sm font-medium hover:underline">
              Add your first item →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, catItems]) => (
            <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</h3>
              </div>
              <table className="w-full">
                <tbody>
                  {catItems.map((item, i) => (
                    <tr key={item.id} className={`${i < catItems.length - 1 ? 'border-b border-gray-50' : ''} ${!item.active ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3 w-44">
                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{item.line_item_number}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-700">{item.description}</td>
                      <td className="px-5 py-3 text-sm text-gray-900 text-right font-medium w-24">${Number(item.unit_price).toFixed(2)}</td>
                      <td className="px-5 py-3 text-center w-24">
                        <button onClick={() => handleToggleActive(item)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                            item.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}>
                          {item.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right w-20">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteId(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-xs text-gray-400 mt-4">
          {items.filter(i => i.active).length} active item{items.filter(i => i.active).length !== 1 ? 's' : ''}
          {items.filter(i => !i.active).length > 0 && `, ${items.filter(i => !i.active).length} inactive`} in master catalogue
        </p>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Delete master item?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete it from the master catalogue. Providers who have already added it to their own list will keep their copy.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
