import { createClient } from '@/lib/supabase/server'
import ActionKanban from '@/components/admin/ActionKanban'

export default async function ActionsPage() {
  const supabase = await createClient()

  const [{ data: openActions }, { data: closedActions }, { data: profiles }] = await Promise.all([
    supabase
      .from('actions')
      .select('id, title, priority, action_type, action_area, assigned_to, assigned_user_id, status, due_date, sent_at, updated_at, contact:contacts(id, full_name, email, date_added, display_id), org:organizations(id, name, org_type)')
      .not('status', 'in', '("Done","Committed","Declined","Unresponsive","Dropped","Skipped")')
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('actions')
      .select('id, title, priority, action_type, action_area, assigned_to, assigned_user_id, status, due_date, sent_at, updated_at, contact:contacts(id, full_name, email, date_added, display_id), org:organizations(id, name, org_type)')
      .in('status', ['Done', 'Committed', 'Declined', 'Unresponsive', 'Dropped', 'Skipped'])
      .order('due_date', { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name'),
  ])

  const actions = [...(openActions ?? []), ...(closedActions ?? [])]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Contact Pipeline</h1>
        <p className="text-gray-500 mt-1">Track outreach — queue, contact, follow up, close.</p>
      </div>
      <ActionKanban
        initialActions={(actions ?? []) as any}
        users={(profiles ?? []) as any}
      />
    </div>
  )
}
