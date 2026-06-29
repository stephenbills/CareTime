'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, UserCheck, Calendar,
  FileText, BarChart2, Settings, LogOut
} from 'lucide-react'

const nav = [
  { label: 'Dashboard', href: '/provider/dashboard', icon: LayoutDashboard },
  { label: 'Clients', href: '/provider/clients', icon: Users },
  { label: 'Carers', href: '/provider/carers', icon: UserCheck },
  { label: 'Calendar', href: '/provider/calendar', icon: Calendar },
  { label: 'Invoices', href: '/provider/invoices', icon: FileText },
  { label: 'Reports', href: '/provider/reports', icon: BarChart2 },
  { label: 'Settings', href: '/provider/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="w-56 bg-gray-900 min-h-screen flex flex-col">
      <div className="px-4 py-5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">C</span>
          </div>
          <span className="text-white font-semibold text-sm">CareTime</span>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 py-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white w-full transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  )
}
