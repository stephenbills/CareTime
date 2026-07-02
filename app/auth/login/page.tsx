'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { detectUserRole, ROLE_ROUTES } from '@/lib/auth/roles'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const role = await detectUserRole(supabase, data.user.id)

    if (!role) {
      setError('Your account is not linked to a role yet. Please contact your Provider.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    router.push(ROLE_ROUTES[role])
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address first'); return }
    setResetLoading(true)
    setError('')

    // Use our server-side API which sends via Brevo directly
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error || 'Failed to send reset email. Please try again.')
    } else {
      setResetSent(true)
    }
    setResetLoading(false)
  }

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
          <p className="text-center text-gray-500 text-sm mb-6">
            Enter your email and we'll send you a reset link
          </p>

          {resetSent ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                ✓ Password reset email sent to {email}. Check your inbox.
              </div>
              <button onClick={() => { setShowReset(false); setResetSent(false) }}
                className="w-full text-blue-600 text-sm hover:underline">
                Back to login
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@example.com" required autoComplete="email" />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{error}</div>
              )}
              <button type="submit" disabled={resetLoading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {resetLoading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => { setShowReset(false); setError('') }}
                className="w-full text-gray-400 text-sm hover:text-gray-600 transition-colors">
                Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

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

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button
          onClick={() => { setShowReset(true); setError('') }}
          className="w-full text-center text-sm text-gray-400 hover:text-blue-600 mt-4 transition-colors"
        >
          Forgot password?
        </button>
      </div>
    </div>
  )
}
