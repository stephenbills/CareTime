'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Calendar, MessageSquare, User, LogOut } from 'lucide-react'

const NAV = [
  { label: 'Home', href: '/client/dashboard', icon: LayoutDashboard },
  { label: 'Calendar', href: '/client/calendar', icon: Calendar },
  { label: 'Notes', href: '/client/notes', icon: MessageSquare },
  { label: 'My Details', href: '/client/details', icon: User },
]

export default function ClientBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <>
      <div className="h-20" />
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
        <div className="flex items-stretch">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link key={href} href={href}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${
                  active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
          <button onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-gray-400 hover:text-red-500 transition-colors">
            <LogOut size={22} strokeWidth={1.8} />
            <span className="text-[10px] font-medium">Logout</span>
          </button>
        </div>
      </nav>
    </>
  )
}
