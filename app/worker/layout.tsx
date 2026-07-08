import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WorkerBottomNav from '@/components/WorkerBottomNav'

export default async function CarerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: worker } = await supabase.from('carers').select('name').eq('user_id', user.id).maybeSingle()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm">CareTime</span>
          </div>
          {worker?.name && (
            <span className="text-sm font-medium text-gray-600">{worker.name}</span>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-lg mx-auto">
        {children}
      </main>

      <WorkerBottomNav />
    </div>
  )
}
