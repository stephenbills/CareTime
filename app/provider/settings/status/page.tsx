'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, ArrowRight, Info } from 'lucide-react'
import Link from 'next/link'

const DEFAULT_STATUSES = [
  {
    value: 'awaiting_acceptance', label: 'Awaiting Acceptance',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    description: 'Activity created but Worker has not yet accepted',
    next: ['scheduled', 'cancelled'],
  },
  {
    value: 'scheduled', label: 'Scheduled',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Worker has accepted — shift is confirmed',
    next: ['in_progress', 'cancelled'],
  },
  {
    value: 'in_progress', label: 'In Progress',
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Worker has started the shift',
    next: ['awaiting_client_approval'],
  },
  {
    value: 'awaiting_client_approval', label: 'Awaiting Client Approval',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    description: 'Worker has submitted the shift — waiting for Client to approve or reject',
    next: ['awaiting_payment_approval', 'rejected'],
  },
  {
    value: 'awaiting_payment_approval', label: 'Awaiting Payment Approval',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'Client approved — waiting for Provider to approve payment',
    next: ['ready_for_payment'],
  },
  {
    value: 'ready_for_payment', label: 'Ready for Payment',
    color: 'bg-green-100 text-green-800 border-green-300',
    description: 'Provider approved — ready to be invoiced',
    next: ['paid'],
  },
  {
    value: 'paid', label: 'Paid',
    color: 'bg-gray-100 text-gray-600 border-gray-300',
    description: 'Invoice generated and payment completed',
    next: [],
  },
  {
    value: 'rejected', label: 'Rejected',
    color: 'bg-red-100 text-red-800 border-red-300',
    description: 'Client rejected the shift submission',
    next: ['awaiting_acceptance'],
  },
  {
    value: 'cancelled', label: 'Cancelled',
    color: 'bg-gray-100 text-gray-400 border-gray-300',
    description: 'Activity was cancelled',
    next: [],
  },
]

export default function StatusSettingsPage() {
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES)
  const [editing, setEditing] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saved, setSaved] = useState(false)

  function startEdit(s: typeof DEFAULT_STATUSES[0]) {
    setEditing(s.value)
    setEditLabel(s.label)
    setEditDesc(s.description)
  }

  function saveEdit() {
    setStatuses(prev => prev.map(s =>
      s.value === editing ? { ...s, label: editLabel, description: editDesc } : s
    ))
    setEditing(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/settings" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Statuses</h1>
          <p className="text-gray-500 text-sm mt-0.5">View and customise the activity workflow</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
        <div className="flex gap-2">
          <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Activities follow this workflow from creation to payment. Click any status to edit its display name and description. The workflow order cannot be changed.
          </p>
        </div>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 mb-4 text-sm text-green-700">
          ✓ Status updated
        </div>
      )}

      <div className="space-y-3">
        {statuses.map((s, i) => (
          <div key={s.value}>
            {editing === s.value ? (
              <div className="bg-white rounded-xl border-2 border-blue-400 shadow-sm p-5 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
                  <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">
                    Save
                  </button>
                  <button onClick={() => setEditing(null)}
                    className="text-gray-600 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-100">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => startEdit(s)}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-blue-200 cursor-pointer transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${s.color}`}>
                        {s.label}
                      </span>
                      <span className="text-xs text-gray-300 font-mono">{s.value}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1.5">{s.description}</p>
                  </div>
                  {s.next.length > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <ArrowRight size={12} className="text-gray-300" />
                      <div className="flex flex-wrap gap-1">
                        {s.next.map(n => {
                          const ns = statuses.find(x => x.value === n)
                          return (
                            <span key={n} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${ns?.color || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                              {ns?.label || n}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Arrow between statuses */}
            {i < statuses.length - 1 && i < 6 && (
              <div className="flex justify-center py-1">
                <div className="w-0.5 h-3 bg-gray-200 rounded-full" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
