'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/contacts/review', label: 'Review Wizard' },
  { href: '/organizations', label: 'Orgs' },
  { href: '/actions', label: 'Org Pipeline' },
  { href: '/my-pipeline', label: 'My Pipeline' },
  { href: '/contacts/merge', label: 'Dedup' },
  { href: '/imports', label: 'Imports' },
  { href: '/sender-preview', label: 'Sender View' },
  { href: '/team', label: 'Team' },
  { href: '/templates', label: 'Templates' },
]

export default function AdminNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 relative z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <span className="font-semibold text-sm text-gray-900">CFP CRM</span>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-5">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm font-medium transition-colors',
                pathname === item.href || (item.href !== '/contacts/review' && pathname.startsWith(item.href) && item.href !== '/contacts')
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden md:block truncate max-w-40">{userEmail}</span>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-500 hover:text-gray-900 hidden md:block"
          >
            Sign out
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(o => !o)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Menu"
          >
            {open ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-white border-b border-gray-200 shadow-lg">
          <div className="px-4 py-2 divide-y divide-gray-100">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'block py-3 text-sm font-medium',
                  pathname === item.href || (item.href !== '/contacts/review' && pathname.startsWith(item.href) && item.href !== '/contacts')
                    ? 'text-blue-600'
                    : 'text-gray-700'
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="py-3 flex items-center justify-between">
              <span className="text-xs text-gray-400 truncate">{userEmail}</span>
              <button
                onClick={handleSignOut}
                className="text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
