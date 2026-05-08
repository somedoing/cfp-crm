'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SenderError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    console.error('Sender route error:', error)
  }, [error])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
        <p className="text-gray-500 mt-1 text-sm">There was a problem loading this page.</p>
        <div className="flex gap-3 mt-6 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Try again
          </button>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
