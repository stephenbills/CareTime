import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientBottomNav from '@/components/ClientBottomNav'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: client } = await supabase.from('clients').select('name').eq('user_id', user.id).maybeSingle()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">C</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">{client?.name || 'CareTime'}</span>
        </div>
      </header>
      <main className="max-w-lg mx-auto">
        {children}
      </main>
      <ClientBottomNav />
    </div>
  )
}
