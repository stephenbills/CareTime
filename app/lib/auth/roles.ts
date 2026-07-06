import { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'provider' | 'worker' | 'client' | 'nominee' | 'administrator' | null

export const ROLE_ROUTES: Record<string, string> = {
  provider: '/provider/dashboard',
  worker: '/worker/dashboard',
  client: '/client/dashboard',
  nominee: '/client/dashboard',   // Nominees use Client interface for now
  administrator: '/admin',
}

// Determines the role of the currently logged-in user by checking all app tables.
// Returns the role string, or null if no matching record is found.
export async function detectUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRole> {
  const [
    { data: provider },
    { data: worker },
    { data: client },
    { data: nominee },
    { data: admin },
  ] = await Promise.all([
    supabase.from('providers').select('id').eq('user_id', userId).maybeSingle(),
    supabase.from('carers').select('id').eq('user_id', userId).maybeSingle(),
    supabase.from('clients').select('id').eq('user_id', userId).maybeSingle(),
    supabase.from('nominees').select('id').eq('user_id', userId).maybeSingle(),
    supabase.from('administrators').select('id').eq('user_id', userId).maybeSingle(),
  ])

  if (provider) return 'provider'
  if (worker) return 'worker'
  if (client) return 'client'
  if (nominee) return 'nominee'
  if (admin) return 'administrator'
  return null
}
