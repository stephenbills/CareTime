'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { detectAllRoles, ROLE_ROUTES, ROLE_LABELS, UserRole } from '@/lib/auth/roles'
import { Shield, Users, UserCheck, User, Briefcase } from 'lucide-react'

const ROLE_ICONS: Record<string, any> = {
  administrator: Shield,
  provider: Briefcase,
  worker: UserCheck,
  client: User,
  nominee: Users,
}

const ROLE_COLORS: Record<string, string> = {
  administrator: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
  provider: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
  worker: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
  client: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
  nominee: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  // Multi-role state
  const [roles, setRoles] = useState<UserRole[]>([])
  const [showRolePicker, setShowRolePicker] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }

    const userRoles = await detectAllRoles(supabase, data.user.id)

    if (userRoles.length === 0) {
      setError('Your account is not linked to a role yet. Please contact your Provider.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (userRoles.length === 1) {
      router.push(ROLE_ROUTES[userRoles[0]!])
    } else {
      setRoles(userRoles)
      setShowRolePicker(true)
      setLoading(false)
    }
  }

  function selectRole(role: UserRole) {
    if (role) router.push(ROLE_ROUTES[role])
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address first'); return }
    setResetLoading(true)
    setError('')
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const result = await res.json()
    if (!res.ok) { setError(result.error || 'Failed to send reset email. Please try again.') }
    else { setResetSent(true) }
    setResetLoading(false)
  }

  // Role picker screen
  if (showRolePicker) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">C</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-center text-gray-900 mb-1">Select Role</h1>
          <p className="text-center text-gray-500 text-sm mb-6">
            You have multiple roles. Choose how you'd like to sign in.
          </p>
          <div className="space-y-3">
            {roles.map(role => {
              if (!role) return null
              const Icon = ROLE_ICONS[role] || User
              return (
                <button key={role} onClick={() => selectRole(role)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${ROLE_COLORS[role] || 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}>
                  <Icon size={22} />
                  <div className="text-left">
                    <p className="font-semibold text-sm">{ROLE_LABELS[role] || role}</p>
                    <p className="text-xs opacity-70">
                      {role === 'provider' && 'Manage clients, workers, and activities'}
                      {role === 'worker' && 'View and manage your shifts'}
                      {role === 'client' && 'Request and approve activities'}
                      {role === 'administrator' && 'System administration'}
                      {role === 'nominee' && 'Manage activities for your clients'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Reset password screen
  if (showReset) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">C</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-center text-gray-900 mb-1">Reset Password</h1>
          <p className="text-center text-gray-500 text-sm mb-6">Enter your email and we'll send you a reset link</p>
          {resetSent ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                ✓ Password reset email sent to {email}. Check your inbox.
              </div>
              <button onClick={() => { setShowReset(false); setResetSent(false) }}
                className="w-full text-blue-600 text-sm hover:underline">Back to login</button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@example.com" required autoComplete="email" />
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{error}</div>}
              <button type="submit" disabled={resetLoading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {resetLoading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => { setShowReset(false); setError('') }}
                className="w-full text-gray-400 text-sm hover:text-gray-600">Back to login</button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // Login screen
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">CareTime</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Sign in to your account</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com" required autoComplete="email" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••" required autoComplete="current-password" />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <button onClick={() => { setShowReset(true); setError('') }}
          className="w-full text-center text-sm text-gray-400 hover:text-blue-600 mt-4">Forgot password?</button>
      </div>
    </div>
  )
}
