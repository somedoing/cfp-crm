import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <span className="font-semibold text-sm text-gray-900">My Outreach Queue</span>
          <span className="text-xs text-gray-400">Community First Party</span>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
