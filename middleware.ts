import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const publicPaths = ['/auth/login', '/auth/callback', '/auth/confirm', '/auth/reset-password', '/auth/verify-link']
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))

  // API routes return their own JSON error responses when unauthenticated
  // (every one of them enforces its own auth via requireProvider()/requireUser()
  // except /api/reset-password, which must be publicly callable by design).
  // Redirecting them here instead breaks any unauthenticated API call: a POST
  // gets 307'd to /auth/login (a GET-only page), which 405s — this is exactly
  // what broke the "Forgot Password" flow, since requesting a reset is by
  // definition done while logged out.
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')

  if (!user && !isPublic && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
