'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function CarersPage() {
  const [workers, setCarers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('carers').select('*').order('name').then(({ data }) => setCarers(data || []))
  }, [])

  const filtered = workers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workers</h1>
          <p className="text-gray-500 text-sm mt-1">{workers.length} worker{workers.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/provider/carers/new"
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} /> Add Worker
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search workers…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
                <Link href={`/provider/carers/${worker.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{worker.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{worker.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {!worker.active && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                    <ChevronRight size={15} className="text-gray-300" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
