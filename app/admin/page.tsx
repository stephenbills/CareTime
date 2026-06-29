'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Users, UserCheck, Building2, RefreshCw, Mail } from 'lucide-react'

const ROLES = ['provider', 'carer', 'client', 'nominee']

type UserRecord = {
  id: string
  email: string
  role: string
  name: string
  created_at: string
  last_sign_in: string | null
}

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || ''

export default function AdminPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')

  // New user form
  const [form, setForm] = useState({ email: '', name: '', role: 'provider', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)

  const supabase = createClient()

  // Simple PIN gate — not a replacement for proper auth but keeps it off the open web
  const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '123456'

  function handlePin(e: React.FormEvent) {
    e.preventDefault()
    if (pin === ADMIN_PIN) { setAuthed(true); loadUsers() }
    else setPinError('Incorrect PIN')
  }

  async function loadUsers() {
    setLoading(true)
    // Load from our app tables
    const [{ data: providers }, { data: carers }, { data: clients }] = await Promise.all([
      supabase.from('providers').select('id, name, email, created_at, user_id'),
      supabase.from('carers').select('id, name, email, created_at, user_id'),
      supabase.from('clients').select('id, name, email, created_at'),
    ])

    const combined: UserRecord[] = [
      ...(providers || []).map((p: any) => ({ id: p.user_id || p.id, email: p.email || '', role: 'provider', name: p.name || '', created_at: p.created_at, last_sign_in: null })),
      ...(carers || []).map((c: any) => ({ id: c.user_id || c.id, email: c.email || '', role: 'carer', name: c.name || '', created_at: c.created_at, last_sign_in: null })),
      ...(clients || []).map((c: any) => ({ id: c.id, email: c.email || '', role: 'client', name: c.name || '', created_at: c.created_at, last_sign_in: null })),
    ]
    setUsers(combined)
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.email.trim()) { setError('Email is required'); return }
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.password || form.password.length < 6) { setError('Password must be at least 6 characters'); return }

    setSaving(true)

    // Create auth user via Supabase signUp
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { name: form.name, role: form.role } }
    })

    if (authErr) { setError(authErr.message); setSaving(false); return }

    const userId = authData.user?.id

    // Also create a record in the appropriate table
    if (userId) {
      if (form.role === 'provider') {
        await supabase.from('providers').insert({
          user_id: userId, name: form.name, email: form.email.trim(), active: true
        })
      } else if (form.role === 'carer') {
        await supabase.from('carers').insert({
          user_id: userId, name: form.name, email: form.email.trim(), active: true
        })
      } else if (form.role === 'client') {
        await supabase.from('clients').insert({
          name: form.name, email: form.email.trim(), active: true
        })
      } else if (form.role === 'nominee') {
        await supabase.from('nominees').insert({
          user_id: userId, name: form.name, email: form.email.trim()
        })
      }
    }

    setSaving(false)
    setSuccess(`✓ Created ${form.role} account for ${form.email}. They can now log in.`)
    setForm({ email: '', name: '', role: 'provider', password: '' })
    setShowForm(false)
    loadUsers()
  }

  const roleIcon: Record<string, any> = {
    provider: Building2, carer: UserCheck, client: Users, nominee: Users
  }
  const roleColor: Record<string, string> = {
    provider: 'bg-blue-100 text-blue-700',
    carer: 'bg-green-100 text-green-700',
    client: 'bg-purple-100 text-purple-700',
    nominee: 'bg-orange-100 text-orange-700',
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg font-bold">A</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-center text-gray-900 mb-1">Admin Access</h1>
          <p className="text-center text-gray-400 text-sm mb-6">Enter your admin PIN to continue</p>
          <form onSubmit={handlePin} className="space-y-4">
            <input type="password" value={pin} onChange={e => setPin(e.target.value)}
              placeholder="Admin PIN" maxLength={12}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-gray-900" />
            {pinError && <p className="text-red-500 text-sm text-center">{pinError}</p>}
            <button type="submit"
              className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
              Enter
            </button>
          </form>
        </div>
      </div>
    )
  }

  const counts = {
    provider: users.filter(u => u.role === 'provider').length,
    carer: users.filter(u => u.role === 'carer').length,
    client: users.filter(u => u.role === 'client').length,
    nominee: users.filter(u => u.role === 'nominee').length,
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CareTime Admin</h1>
            <p className="text-gray-500 text-sm mt-1">Manage user accounts across all roles</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadUsers}
              className="flex items-center gap-1.5 border border-gray-200 bg-white px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => { setShowForm(true); setError(''); setSuccess('') }}
              className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
              <Plus size={15} /> Add User
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {(['provider','carer','client','nominee'] as const).map(role => {
            const Icon = roleIcon[role]
            return (
              <div key={role} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-400 capitalize mb-1">{role}s</p>
                <p className="text-2xl font-bold text-gray-900">{counts[role]}</p>
              </div>
            )
          })}
        </div>

        {/* Add user form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Create New User Account</h2>
            <p className="text-sm text-gray-500 mb-4">
              This creates a login account and a matching record in the database.
              The user can log in immediately with the password you set.
            </p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Jane Smith"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {ROLES.map(r => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="user@example.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Password <span className="text-red-500">*</span></label>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 6 characters"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">⚠ {error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  <Plus size={14} /> {saving ? 'Creating…' : 'Create Account'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-6">
            {success}
          </div>
        )}

        {/* User list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">All Users</h2>
            <span className="text-xs text-gray-400">{users.length} total</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No users yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{u.name || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{u.email || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleColor[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('en-AU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-xs text-amber-700 font-medium mb-1">Security note</p>
          <p className="text-xs text-amber-600">
            Set <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_ADMIN_PIN</code> in your Vercel environment variables to a strong PIN.
            This page is at <code className="bg-amber-100 px-1 rounded">/admin</code> — keep the URL private.
          </p>
        </div>
      </div>
    </div>
  )
}
