'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare } from 'lucide-react'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function ClientNotesPage() {
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: clientRecords } = await supabase
        .from('clients').select('id').eq('user_id', user.id)
      if (!clientRecords || clientRecords.length === 0) { setLoading(false); return }
      const clientIds = clientRecords.map(c => c.id)

      // Get all completed activities with worker comments
      const { data: acts } = await supabase
        .from('activities')
        .select('*, carers(name)')
        .in('client_id', clientIds)
        .not('carer_comments', 'is', null)
        .in('status', ['awaiting_client_approval', 'awaiting_payment_approval', 'ready_for_payment', 'paid'])
        .order('actual_start_time', { ascending: false })

      setNotes(acts || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-gray-400 text-sm">Loading…</div>
    </div>
  )

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="pt-1">
        <h1 className="text-xl font-bold text-gray-900">Shift Notes</h1>
        <p className="text-gray-400 text-xs mt-0.5">Comments from your Workers after each shift</p>
      </div>

      {notes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <MessageSquare size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No shift notes yet.</p>
          <p className="text-gray-300 text-xs mt-1">Worker comments will appear here after completed shifts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(act => {
            const workerName = (act.carers as any)?.name || '—'
            const startTime = act.actual_start_time || act.start_time
            const endTime = act.actual_end_time || act.end_time
            return (
              <div key={act.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{act.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{workerName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500 font-medium">
                      {startTime ? formatDateTime(startTime).split(',').slice(0,2).join(',') : '—'}
                    </p>
                    {startTime && endTime && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatTime(startTime)} – {formatTime(endTime)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Comment */}
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-sm text-gray-700 leading-relaxed">{act.carer_comments}</p>
                </div>

                {/* Client's own rating/comments if approved */}
                {act.client_rating && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-400">Your rating:</span>
                    <span className="text-amber-400 text-sm">
                      {'★'.repeat(act.client_rating)}{'☆'.repeat(5 - act.client_rating)}
                    </span>
                  </div>
                )}
                {act.client_comments && (
                  <p className="text-xs text-gray-400 mt-1 italic">Your comment: {act.client_comments}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
