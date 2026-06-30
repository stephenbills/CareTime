'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Check, X, Library, ListChecks, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'

type MasterItem = {
  id: string
  line_item_number: string
  description: string
  support_category: string
  unit_price: number
  active: boolean
}

type LocalItem = {
  id: string
  master_item_id: string | null
  line_item_number: string
  description: string
  support_category: string
  unit_price: number
  active: boolean
}

export default function ProviderNdisPage() {
  const [view, setView] = useState<'mine' | 'master'>('mine')
  const [masterItems, setMasterItems] = useState<MasterItem[]>([])
  const [myItems, setMyItems] = useState<LocalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [providerId, setProviderId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [showInactiveMine, setShowInactiveMine] = useState(false)
  const supabase = createClient()

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: provider } = await supabase
      .from('providers').select('id').eq('user_id', user.id).maybeSingle()
    if (!provider) { setLoading(false); return }
    setProviderId(provider.id)

    const [{ data: master }, { data: mine }] = await Promise.all([
      supabase.from('ndis_master_items').select('*').eq('active', true).order('line_item_number'),
      supabase.from('ndis_line_items').select('*').eq('provider_id', provider.id).order('line_item_number'),
    ])
    setMasterItems(master || [])
    setMyItems(mine || [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const myMasterIds = new Set(myItems.map(i => i.master_item_id).filter(Boolean))

  const filteredMaster = masterItems.filter(i =>
    !search ||
    i.line_item_number.toLowerCase().includes(search.toLowerCase()) ||
    i.description.toLowerCase().includes(search.toLowerCase())
  )

  const groupedMaster = filteredMaster.reduce((acc, item) => {
    const cat = item.support_category || 'Uncategorised'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, MasterItem[]>)

  const visibleMine = myItems.filter(i => showInactiveMine ? true : i.active)
  const groupedMine = visibleMine.reduce((acc, item) => {
    const cat = item.support_category || 'Uncategorised'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, LocalItem[]>)

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAddSelected() {
    setError('')
    if (selectedIds.size === 0) return
    setAdding(true)

    const toInsert = masterItems
      .filter(m => selectedIds.has(m.id) && !myMasterIds.has(m.id))
      .map(m => ({
        provider_id: providerId,
        master_item_id: m.id,
        line_item_number: m.line_item_number,
        description: m.description,
        support_category: m.support_category,
        unit_price: m.unit_price,
        active: true,
      }))

    if (toInsert.length > 0) {
      const { error: err } = await supabase.from('ndis_line_items').insert(toInsert)
      if (err) { setError(err.message); setAdding(false); return }
    }

    setAdding(false)
    setSelectedIds(new Set())
    loadAll()
    setView('mine')
  }

  async function handleToggleActive(item: LocalItem) {
    await supabase.from('ndis_line_items').update({ active: !item.active }).eq('id', item.id)
    loadAll()
  }

  async function handleRemove(id: string) {
    await supabase.from('ndis_line_items').delete().eq('id', id)
    loadAll()
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  if (!providerId) return (
    <div className="p-8">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
        Please save your Provider Details first before adding NDIS line items.{' '}
        <Link href="/provider/settings/details" className="underline font-medium">Go to Provider Details</Link>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/settings" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">NDIS Line Items</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Select line items from the master catalogue to build your own list
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setView('mine')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === 'mine' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ListChecks size={14} /> My Catalogue ({myItems.filter(i => i.active).length})
        </button>
        <button
          onClick={() => setView('master')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === 'master' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Library size={14} /> Browse Master List ({masterItems.length})
        </button>
      </div>

      {/* MY CATALOGUE VIEW */}
      {view === 'mine' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
              <input type="checkbox" checked={showInactiveMine} onChange={e => setShowInactiveMine(e.target.checked)} className="rounded" />
              Show inactive
            </label>
          </div>

          {visibleMine.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-gray-400 text-sm mb-3">You haven't added any NDIS line items yet.</p>
              <button onClick={() => setView('master')} className="text-blue-600 text-sm font-medium hover:text-blue-700">
                Browse the master list to add items →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedMine).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</h3>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={item.id} className={`${i < items.length - 1 ? 'border-b border-gray-50' : ''} ${!item.active ? 'opacity-50' : ''}`}>
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
                          <td className="px-5 py-3 text-right w-16">
                            <button onClick={() => handleRemove(item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* MASTER LIST BROWSE VIEW */}
      {view === 'master' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by line item number or description…"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {selectedIds.size > 0 && (
            <div className="sticky top-4 z-10 bg-blue-600 text-white rounded-xl px-4 py-3 mb-4 flex items-center justify-between shadow-lg">
              <span className="text-sm font-medium">{selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected</span>
              <div className="flex gap-2">
                <button onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 text-sm rounded-lg hover:bg-blue-700 transition-colors">
                  Clear
                </button>
                <button onClick={handleAddSelected} disabled={adding}
                  className="flex items-center gap-1.5 bg-white text-blue-600 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50 transition-colors">
                  <Check size={14} /> {adding ? 'Adding…' : 'Add to My Catalogue'}
                </button>
              </div>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">⚠ {error}</div>}

          {filteredMaster.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-gray-400 text-sm">
                {masterItems.length === 0
                  ? 'The master catalogue is empty. Ask your Administrator to add NDIS line items.'
                  : 'No items match your search.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedMaster).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</h3>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {items.map((item, i) => {
                        const alreadyAdded = myMasterIds.has(item.id)
                        const isSelected = selectedIds.has(item.id)
                        return (
                          <tr
                            key={item.id}
                            onClick={() => !alreadyAdded && toggleSelect(item.id)}
                            className={`${i < items.length - 1 ? 'border-b border-gray-50' : ''} ${
                              alreadyAdded ? 'opacity-40' : 'cursor-pointer hover:bg-gray-50'
                            } ${isSelected ? 'bg-blue-50' : ''} transition-colors`}
                          >
                            <td className="px-5 py-3 w-10">
                              {alreadyAdded ? (
                                <Check size={16} className="text-green-500" />
                              ) : (
                                <input
                                  type="checkbox" checked={isSelected}
                                  onChange={() => toggleSelect(item.id)}
                                  onClick={e => e.stopPropagation()}
                                  className="rounded"
                                />
                              )}
                            </td>
                            <td className="px-5 py-3 w-44">
                              <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{item.line_item_number}</span>
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-700">{item.description}</td>
                            <td className="px-5 py-3 text-sm text-gray-900 text-right font-medium w-24">${Number(item.unit_price).toFixed(2)}</td>
                            <td className="px-5 py-3 text-right w-32">
                              {alreadyAdded && <span className="text-xs text-green-600 font-medium">In your catalogue</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
