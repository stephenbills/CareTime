'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, Users, UserCheck, Activity } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ providers: 0, clients: 0, workers: 0, activities: 0 })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [p, c, w, a] = await Promise.all([
        supabase.from('providers').select('id', { count: 'exact' }),
        supabase.from('clients').select('id', { count: 'exact' }),
        supabase.from('carers').select('id', { count: 'exact' }),
        supabase.from('activities').select('id', { count: 'exact' }),
      ])
      for (const [label, res] of [['providers', p], ['clients', c], ['workers', w], ['activities', a]] as const) {
        if (res.error) console.error(`Failed to load ${label} count:`, res.error)
      }
      setStats({
        providers: p.count ?? 0, clients: c.count ?? 0,
        workers: w.count ?? 0, activities: a.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    { label: 'Providers', value: stats.providers, icon: Building2, color: 'bg-blue-500', href: '/admin/providers' },
    { label: 'Clients', value: stats.clients, icon: Users, color: 'bg-purple-500' },
    { label: 'Workers', value: stats.workers, icon: UserCheck, color: 'bg-green-500' },
    { label: 'Activities', value: stats.activities, icon: Activity, color: 'bg-amber-500' },
  ]

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Administration</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, href }) => {
          const content = (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">{label}</span>
                <div className={`${color} w-9 h-9 rounded-lg flex items-center justify-center`}>
                  <Icon size={18} className="text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
            </div>
          )
          return href ? <Link key={label} href={href}>{content}</Link> : <div key={label}>{content}</div>
        })}
      </div>
    </div>
  )
}
