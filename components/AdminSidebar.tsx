'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Shield, Building2, LogOut, LayoutDashboard } from 'lucide-react'

const nav = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Providers', href: '/admin/providers', icon: Building2 },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-red-400" />
          <span className="font-bold text-sm">CareTime Admin</span>
        </div>
      </div>
      <nav className="flex-1 py-3">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 px-5 py-2.5 text-sm transition-colors ${
                active ? 'bg-gray-800 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}>
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>
      <button onClick={handleLogout}
        className="flex items-center gap-2.5 px-5 py-4 text-sm text-gray-500 hover:text-white border-t border-gray-800 transition-colors">
        <LogOut size={16} /> Sign Out
      </button>
    </aside>
  )
}
