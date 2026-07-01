import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  // Let the login page handle role detection on next visit;
  // for direct root visits by authenticated users, default to provider
  redirect('/provider/dashboard')
}
