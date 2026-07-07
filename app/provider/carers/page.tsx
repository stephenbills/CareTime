'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, ChevronRight, Mail, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useProviderId } from '@/lib/hooks/useProvider'

export default function CarersPage() {
  const [workers, setWorkers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [inviting, setInviting] = useState<string | null>(null)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const { providerId } = useProviderId()
  const supabase = createClient()

  useEffect(() => { if (providerId) loadWorkers() }, [providerId])

  async function loadWorkers() {
    if (!providerId) return
    // Get workers linked to this provider via junction table
    const { data: links } = await supabase
      .from('provider_carers')
      .select('carer_id, carers(*)')
      .eq('provider_id', providerId)
    const wks = (links || []).map((l: any) => l.carers).filter(Boolean)
    setWorkers(wks)
  }

  async function sendInvite(worker: any) {
    if (!worker.email) return
    setInviting(worker.id)
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: worker.email, name: worker.name, role: 'worker', recordId: worker.id }),
    })
    if (res.ok) {
      setInvitedIds(prev => new Set([...prev, worker.id]))
      await loadWorkers()
    }
    setInviting(null)
  }

  const filtered = workers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  const uninvited = workers.filter(w => w.active && !w.user_id).length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workers</h1>
          <p className="text-gray-500 text-sm mt-1">{workers.length} worker{workers.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/provider/carers/new"
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={15} /> Add Worker
        </Link>
      </div>

      {/* Uninvited alert */}
      {uninvited > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={15} className="text-amber-600" />
            <p className="text-sm text-amber-800">
              {uninvited} worker{uninvited !== 1 ? 's have' : ' has'} not been invited to the app yet
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search workers…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            {search ? 'No workers match your search.' : 'No workers yet. Add your first worker.'}
          </div>
        ) : (
          <ul>
            {filtered.map((worker, i) => (
              <li key={worker.id} className={i < filtered.length - 1 ? 'border-b border-gray-50' : ''}>
                <div className="flex items-center justify-between px-5 py-4">
                  <Link href={`/provider/carers/${worker.id}`} className="flex-1 min-w-0 hover:opacity-80">
                    <p className="font-medium text-gray-900 text-sm">{worker.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{worker.email}</p>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {!worker.active && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                    {worker.user_id ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <CheckCircle size={11} /> Invited
                      </span>
                    ) : (
                      <button
                        onClick={() => sendInvite(worker)}
                        disabled={inviting === worker.id || !worker.email || invitedIds.has(worker.id)}
                        className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-full disabled:opacity-50 transition-colors">
                        <Mail size={11} />
                        {inviting === worker.id ? 'Sending…' : invitedIds.has(worker.id) ? 'Sent ✓' : 'Invite'}
                      </button>
                    )}
                    <Link href={`/provider/carers/${worker.id}`}>
                      <ChevronRight size={15} className="text-gray-300" />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
