'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, ChevronRight, Mail, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<any[]>([])
  const [inviting, setInviting] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('providers').select('*').order('name').then(({ data, error }) => {
      if (error) console.error('Failed to load providers:', error)
      setProviders(data || [])
    })
  }, [])

  async function sendInvite(provider: any) {
    if (!provider.email) return
    setInviting(provider.id)
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: provider.email, name: provider.name, role: 'provider', recordId: provider.id }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(`Failed to send invite: ${body.error || res.statusText}`)
    }
    const { data, error } = await supabase.from('providers').select('*').order('name')
    if (error) console.error('Failed to reload providers:', error)
    setProviders(data || [])
    setInviting(null)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Providers</h1>
          <p className="text-gray-500 text-sm mt-1">{providers.length} provider{providers.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/admin/providers/new"
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={15} /> Add Provider
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {providers.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No providers yet.</div>
        ) : (
          <ul>
            {providers.map((p, i) => (
              <li key={p.id} className={i < providers.length - 1 ? 'border-b border-gray-50' : ''}>
                <div className="flex items-center justify-between px-5 py-4">
                  <Link href={`/admin/providers/${p.id}`} className="flex-1 min-w-0 hover:opacity-80">
                    <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{p.email} · {p.phone || '—'}</p>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {p.user_id ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <CheckCircle size={11} /> Invited
                      </span>
                    ) : (
                      <button onClick={() => sendInvite(p)} disabled={inviting === p.id}
                        className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-full disabled:opacity-50">
                        <Mail size={11} /> {inviting === p.id ? 'Sending…' : 'Invite'}
                      </button>
                    )}
                    <Link href={`/admin/providers/${p.id}`}><ChevronRight size={15} className="text-gray-300" /></Link>
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
