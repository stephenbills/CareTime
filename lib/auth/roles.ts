import { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'provider' | 'worker' | 'client' | 'nominee' | 'administrator' | null

export const ROLE_ROUTES: Record<string, string> = {
  provider: '/provider/dashboard',
  worker: '/worker/dashboard',
  client: '/client/dashboard',
  nominee: '/client/dashboard',
  administrator: '/admin',
}

export const ROLE_LABELS: Record<string, string> = {
  provider: 'Provider',
  worker: 'Worker',
  client: 'Client',
  nominee: 'Nominee',
  administrator: 'Administrator',
}

// Detects ALL roles for a user
export async function detectAllRoles(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRole[]> {
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

  const roles: UserRole[] = []
  if (admin) roles.push('administrator')
  if (provider) roles.push('provider')
  if (worker) roles.push('worker')
  if (client) roles.push('client')
  if (nominee) roles.push('nominee')
  return roles
}

// Returns the first role found (backwards compat)
export async function detectUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRole> {
  const roles = await detectAllRoles(supabase, userId)
  return roles.length > 0 ? roles[0] : null
}
