import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // SECURITY: this table lookup is what actually gates the admin panel — without
  // it, any authenticated user (any client/worker/provider) could reach /admin.
  const { data: admin } = await supabase
    .from('administrators').select('id').eq('user_id', user.id).maybeSingle()
  if (!admin) redirect('/auth/login')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
