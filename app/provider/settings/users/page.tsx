import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
export default function Page() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/settings" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 capitalize">users</h1>
      </div>
      <p className="text-gray-500 text-sm">Coming soon.</p>
    </div>
  )
}
