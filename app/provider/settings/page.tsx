'use client'
import Link from 'next/link'
import { ChevronRight, Building2, ClipboardList, DollarSign, CalendarDays, Users } from 'lucide-react'

const SETTINGS_LINKS = [
  { href: '/provider/settings/details', icon: Building2, label: 'Provider Details', desc: 'Organisation info, admin fees, and bank details' },
  { href: '/provider/settings/ndis', icon: ClipboardList, label: 'NDIS Line Items', desc: 'Select line items from the master catalogue' },
  { href: '/provider/settings/rates', icon: DollarSign, label: 'Billing Rates', desc: 'Set standard, weekend and public holiday rates' },
  { href: '/provider/settings/holidays', icon: CalendarDays, label: 'Public Holidays', desc: 'Define public holidays for billing calculations' },
  { href: '/provider/settings/users', icon: Users, label: 'User Management', desc: 'Manage staff who can access this Provider account' },
]

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your organisation and application settings</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SETTINGS_LINKS.map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href}
            className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:bg-blue-50 transition-colors shadow-sm"
          >
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon size={18} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{desc}</p>
            </div>
            <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
