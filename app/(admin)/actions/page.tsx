import { createClient } from '@/lib/supabase/server'
import ActionKanban from '@/components/admin/ActionKanban'

export default async function ActionsPage() {
  const supabase = await createClient()

  const { data: actions } = await supabase
    .from('actions')
    .select('id, title, suggested_ask, priority, action_type, action_area, assigned_to, status, due_date, contact:contacts(id, full_name, email, date_added)')
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Actions</h1>
        <p className="text-gray-500 mt-1">Review actions, edit them, then send to Jon's queue when ready.</p>
      </div>
      <ActionKanban initialActions={(actions ?? []) as any} />
    </div>
  )
}
