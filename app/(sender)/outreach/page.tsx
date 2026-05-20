import { createClient } from '@/lib/supabase/server'
import OutreachTabs from '@/components/sender/OutreachTabs'

export default async function OutreachPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const todayStr = new Date().toISOString().split('T')[0]

  let actions: any[] = []
  try {
    const { data, error } = await supabase
      .from('actions')
      .select(`
        id, contact_id, action_type, action_area, suggested_ask, suggested_message,
        notes, priority, status, due_date, sort_order,
        contact:contacts(
          full_name, display_id, email, phone, notes,
          date_added, town, state,
          volunteer_stage, donor_stage,
          original_source_form, is_volunteer, is_donor, is_signature_collector
        )
      `)
      .eq('assigned_user_id', user?.id ?? '')
      .not('status', 'in', '("Done","Dropped","Skipped","Committed","Declined","Unresponsive","Positive Response","Responded","Needs Review","Supporter","Active","Core")')
      .order('due_date', { ascending: true, nullsFirst: false })

    if (!error && data) actions = data
  } catch {
    // show empty state rather than crashing
  }

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Outreach Queue</h1>
        <p className="text-sm text-gray-500 mt-1">{todayLabel}</p>
      </div>

      <OutreachTabs actions={actions} userId={user?.id ?? ''} today={todayStr} />
    </div>
  )
}
