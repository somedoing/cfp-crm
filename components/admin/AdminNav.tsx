'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/organizations', label: 'Orgs' },
  { href: '/actions', label: 'Org Pipeline' },
  { href: '/my-pipeline', label: 'My Pipeline' },
  { href: '/imports', label: 'Imports' },
  { href: '/team', label: 'Team' },
]

export default function AdminNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 flex items-center justify-between h-12 sm:h-14 gap-2">
        <div className="flex items-center gap-1 sm:gap-5 overflow-x-auto scrollbar-none shrink-0 max-w-full">
          <span className="font-semibold text-sm text-gray-900 shrink-0 mr-1 sm:mr-0">CFP</span>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm font-medium transition-colors whitespace-nowrap px-1',
                pathname.startsWith(item.href)
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <span className="text-xs text-gray-500 hidden sm:block truncate max-w-40">{userEmail}</span>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-500 hover:text-gray-900 whitespace-nowrap"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
