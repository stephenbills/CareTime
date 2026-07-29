'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// Sits in front of the actual Supabase verify link (recovery/invite emails)
// so the token is only ever consumed by a real click, not an automated
// corporate email-security scanner prefetching the link in the inbox —
// that pattern was causing "this link has expired" on the very first
// genuine click, since the scanner had already burned the one-time token.
function VerifyLinkInner() {
  const searchParams = useSearchParams()
  const target = searchParams?.get('to')

  function handleContinue() {
    if (target) window.location.href = decodeURIComponent(target)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
        </div>
        {!target ? (
          <>
            <h1 className="text-xl font-bold text-gray-900">Link Invalid</h1>
            <p className="text-gray-500 text-sm">
              This link is missing required information. Please request a new one.
            </p>
            <a href="/auth/login" className="block text-blue-600 text-sm hover:underline">
              Return to login
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900">Continue to CareTime</h1>
            <p className="text-gray-500 text-sm">
              For your security, click below to continue. This confirms a real person is
              clicking, not an automated email scanner.
            </p>
            <button onClick={handleContinue}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyLinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyLinkInner />
    </Suspense>
  )
}
