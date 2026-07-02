'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function ResetForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Supabase puts tokens in the URL hash when redirecting from a reset link.
    // We need to let the Supabase client exchange them for a session before
    // calling updateUser — otherwise there's no active session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // Session established from the reset link — ready to update password
          setSessionReady(true)
        } else if (event === 'SIGNED_IN' && session) {
          setSessionReady(true)
        }
      }
    )

    // Also check if already have a session (e.g. page reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)

    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }

    // Sign out after password change so they log in fresh with new credentials
    await supabase.auth.signOut()
    setDone(true)
    setTimeout(() => router.push('/auth/login'), 2500)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
        </div>
        <h1 className="text-xl font-bold text-center text-gray-900 mb-1">Set New Password</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Choose a new password for your CareTime account</p>

        {done ? (
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-green-600 text-xl">✓</span>
            </div>
            <p className="text-gray-700 text-sm font-medium">Password updated successfully</p>
            <p className="text-gray-400 text-xs">Redirecting to login…</p>
          </div>
        ) : sessionError ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {sessionError}
            </div>
            <a href="/auth/login" className="block text-center text-blue-600 text-sm hover:underline">
              Return to login
            </a>
          </div>
        ) : !sessionReady ? (
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-sm">Verifying reset link…</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min 6 characters" required autoComplete="new-password" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Repeat password" required autoComplete="new-password" />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">⚠ {error}</div>
            )}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? 'Updating…' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetForm />
    </Suspense>
  )
}
