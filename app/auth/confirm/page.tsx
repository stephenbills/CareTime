'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

const ROLE_ROUTES: Record<string, string> = {
  provider: '/provider/dashboard',
  worker: '/worker/dashboard',
  client: '/client/dashboard',
  nominee: '/client/dashboard',
  administrator: '/admin',
}

function ConfirmInner() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    async function handleConfirm() {
      // Supabase automatically exchanges the token from the URL hash
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        setStatus('error')
        setMessage('This invite link is invalid or has expired. Please contact your Provider.')
        return
      }

      const user = session.user

      // Determine role by checking which app table this user appears in
      const admin = supabase // Using regular client here since user is now authenticated
      const [
        { data: worker },
        { data: provider },
        { data: nominee },
        { data: clientRecord },
      ] = await Promise.all([
        admin.from('carers').select('id').eq('user_id', user.id).maybeSingle(),
        admin.from('providers').select('id').eq('user_id', user.id).maybeSingle(),
        admin.from('nominees').select('id').eq('user_id', user.id).maybeSingle(),
        admin.from('clients').select('id').eq('user_id', user.id).maybeSingle(),
      ])

      // Also check role hint from URL query param (passed in invite redirectTo)
      const roleHint = searchParams?.get('role') || ''

      let destination = '/provider/dashboard'
      if (worker) destination = '/worker/dashboard'
      else if (provider) destination = '/provider/dashboard'
      else if (clientRecord) destination = '/client/dashboard'
      else if (nominee) destination = '/client/dashboard'
      else if (ROLE_ROUTES[roleHint]) destination = ROLE_ROUTES[roleHint]

      setStatus('success')
      setMessage('Welcome to CareTime! Redirecting…')

      // Small delay so the user sees the welcome message
      setTimeout(() => router.push(destination), 1500)
    }

    handleConfirm()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">C</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">CareTime</h1>

        {status === 'loading' && (
          <div className="space-y-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 text-sm">Setting up your account…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-2">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-green-600 text-xl">✓</span>
            </div>
            <p className="text-gray-700 text-sm font-medium">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-red-600 text-xl">✗</span>
            </div>
            <p className="text-red-600 text-sm">{message}</p>
            <a href="/auth/login" className="inline-block mt-2 text-blue-600 text-sm underline">
              Return to login
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ConfirmInner />
    </Suspense>
  )
}
