import { createClient } from '@/lib/supabase/server'

// Verifies the request comes from a logged-in user.
// Returns the user, or null if not authenticated.
export async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// Verifies the request comes from a logged-in Provider (or Administrator).
// Returns { user, providerId } or null.
export async function requireProvider() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const [{ data: provider }, { data: admin }] = await Promise.all([
    supabase.from('providers').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('administrators').select('id').eq('user_id', user.id).maybeSingle(),
  ])

  if (!provider && !admin) return null
  return { user, providerId: provider?.id ?? null, isAdmin: !!admin }
}
