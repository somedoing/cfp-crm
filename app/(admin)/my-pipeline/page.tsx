import { createClient } from '@/lib/supabase/server'
import MyPipeline from '@/components/admin/MyPipeline'

export default async function MyPipelinePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: actions } = await supabase
    .from('actions')
    .select('id, title, priority, action_type, action_area, status, due_date, suggested_ask, suggested_message, notes, contact_id, contact:contacts(id, full_name, email, phone, notes, last_contact_summary), org:organizations(id, name)')
    .eq('assigned_user_id', user?.id ?? '')
    .not('status', 'in', '("Done","Committed","Declined","Unresponsive","Dropped","Skipped")')
    .order('priority', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">My Pipeline</h1>
        <p className="text-gray-500 mt-1">Contacts assigned to you.</p>
      </div>
      <MyPipeline initialActions={(actions ?? []) as any} />
    </div>
  )
}
