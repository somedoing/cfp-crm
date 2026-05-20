import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import OutreachTabs from '@/components/sender/OutreachTabs'
import Link from 'next/link'

export default async function SenderPreviewUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()
  const todayStr = new Date().toISOString().split('T')[0]

  const [{ data: sender }, { data, error }] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', userId).single(),
    supabase
      .from('actions')
      .select(`
        id, contact_id, action_type, action_area, suggested_ask, suggested_message,
        notes, priority, status, due_date,
        contact:contacts(
          full_name, display_id, email, phone, notes,
          town, state,
          volunteer_stage, donor_stage,
          original_source_form, is_volunteer, is_donor, is_signature_collector
        )
      `)
      .eq('assigned_user_id', userId)
      .not('status', 'in', '("Done","Dropped","Skipped","Committed","Declined","Unresponsive","Positive Response")')
      .order('due_date', { ascending: true, nullsFirst: false }),
  ])

  if (!sender) notFound()

  const actions = (!error && data) ? data : []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/sender-preview" className="text-gray-400 hover:text-gray-700 text-sm">
          ← Sender View
        </Link>
        <span className="text-gray-300">·</span>
        <div>
          <span className="font-semibold text-gray-900">{sender.full_name}</span>
          <span className="text-gray-400 text-sm ml-2">{sender.email}</span>
        </div>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium ml-auto">
          Read-only preview
        </span>
      </div>

      <OutreachTabs actions={actions as any} userId={userId} today={todayStr} />
    </div>
  )
}
