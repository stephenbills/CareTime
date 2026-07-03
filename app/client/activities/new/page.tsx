'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notify } from '@/lib/email/notify'

function toLocalInput(date?: Date) {
  const d = date || new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
}

export default function ClientNewActivityPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState(toLocalInput())
  const [endTime, setEndTime] = useState(toLocalInput(new Date(Date.now() + 2 * 60 * 60 * 1000)))
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [providerId, setProviderId] = useState<string | null>(null)
  const [providerEmail, setProviderEmail] = useState<string | null>(null)
  const [providerName, setProviderName] = useState<string | null>(null)
  const [clientAddress, setClientAddress] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: client } = await supabase
        .from('clients').select('*').eq('user_id', user.id).maybeSingle()
      if (!client) return
      setClientId(client.id)

      // Pre-fill address from client record
      const addr = [client.address_line1, client.suburb, client.state, client.postcode]
        .filter(Boolean).join(', ')
      if (addr) {
        setClientAddress(addr)
        setPickupAddress(addr)
        setDropoffAddress(addr)
      }

      // Get provider for notification
      const { data: provider } = await supabase
        .from('providers').select('id, name, email').eq('id', client.provider_id).maybeSingle()
      if (provider) {
        setProviderId(provider.id)
        setProviderEmail(provider.email)
        setProviderName(provider.name)
      }
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Activity title is required'); return }
    if (!startTime) { setError('Start time is required'); return }
    if (!endTime) { setError('End time is required'); return }
    if (new Date(startTime) >= new Date(endTime)) {
      setError('End time must be after start time'); return
    }
    if (!clientId) { setError('Your profile is not set up. Contact your Provider.'); return }

    setSaving(true)

    const { data: created, error: err } = await supabase.from('activities').insert({
      title: title.trim(),
      description: description || null,
      status: 'awaiting_acceptance',
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      pickup_address: pickupAddress || null,
      dropoff_address: dropoffAddress || null,
      venue_address: venueAddress || null,
      client_id: clientId,
      provider_id: providerId,
    }).select().single()

    if (err) { setError(err.message); setSaving(false); return }

    if (created) {
      await supabase.from('activity_status_history').insert({
        activity_id: created.id,
        from_status: null,
        to_status: 'awaiting_acceptance',
      })

      // Notify provider of new activity request
      if (providerEmail) {
        notify('activity_changed', providerEmail, {
          recipientName: providerName || 'Provider',
          activityTitle: title,
          changedBy: 'a Client',
          activityId: created.id,
          role: 'provider',
        })
      }
    }

    setSaving(false)
    router.push('/client/calendar')
  }

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center gap-3 pt-1 mb-5">
        <Link href="/client/calendar" className="p-1 text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Request Activity</h1>
          <p className="text-gray-400 text-xs mt-0.5">Your Provider will assign a Worker</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Activity details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Activity Details</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Community outing, Doctor appointment"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="Any details your Worker should know…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        {/* Timing */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">When</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Start <span className="text-red-500">*</span>
            </label>
            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              End <span className="text-red-500">*</span>
            </label>
            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Locations */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Locations</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Pickup Address</label>
            <input type="text" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)}
              placeholder="Where should the Worker pick you up?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Venue / Activity Location</label>
            <input type="text" value={venueAddress} onChange={e => setVenueAddress(e.target.value)}
              placeholder="Optional — where is the activity?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Drop-off Address</label>
            <input type="text" value={dropoffAddress} onChange={e => setDropoffAddress(e.target.value)}
              placeholder="Where should the Worker drop you off?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3">⚠ {error}</div>
        )}

        <button type="submit" disabled={saving}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl text-sm font-semibold disabled:opacity-50 active:bg-blue-700 transition-colors">
          {saving ? 'Sending Request…' : 'Send Activity Request'}
        </button>
      </form>
    </div>
  )
}
