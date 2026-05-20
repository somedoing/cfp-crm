import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SenderPreviewPage() {
  const supabase = await createClient()

  const { data: senders } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'sender')
    .order('full_name')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Sender View</h1>
        <p className="text-gray-500 mt-1">Preview what each sender sees in their outreach queue.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {(senders ?? []).map(s => (
          <Link
            key={s.id}
            href={`/sender-preview/${s.id}`}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <p className="font-medium text-gray-900">{s.full_name}</p>
            <p className="text-sm text-gray-400 mt-0.5">{s.email}</p>
            <p className="text-xs text-blue-600 mt-2">View queue →</p>
          </Link>
        ))}
        {(senders ?? []).length === 0 && (
          <p className="text-gray-400 text-sm">No senders on the team yet.</p>
        )}
      </div>
    </div>
  )
}
