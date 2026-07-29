import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProvider } from '@/lib/api/auth'
import { ensureSchedulesGenerated } from '@/lib/schedules/ensureGenerated'

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const caller = await requireProvider()
  if (caller?.providerId) {
    await ensureSchedulesGenerated(supabase, caller.providerId)
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
