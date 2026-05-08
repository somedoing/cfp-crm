import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SenderSignOut from '@/components/sender/SenderSignOut'

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <span className="font-semibold text-sm text-gray-900">My Outreach Queue</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:block">{user.email}</span>
            <SenderSignOut />
          </div>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>
    </div>
  )
}
