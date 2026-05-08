import { createClient } from '@/lib/supabase/server'
import OutreachCard from '@/components/sender/OutreachCard'

export default async function OutreachPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const todayStr = new Date().toISOString().split('T')[0]

  let actions: any[] = []
  try {
    const { data, error } = await supabase
      .from('actions')
      .select(`
        id, contact_id, action_type, action_area, suggested_ask, suggested_message, notes, priority, status,
        contact:contacts(
          full_name, display_id, email, phone, notes,
          tags, date_added, town, state,
          volunteer_stage, donor_stage,
          original_source_form, is_volunteer, is_donor, is_signature_collector
        )
      `)
      .eq('assigned_user_id', user?.id ?? '')
      .not('status', 'in', '("Done","Dropped","Skipped","Committed","Declined","Unresponsive")')
      .order('due_date', { ascending: true, nullsFirst: false })

    if (!error && data) {
      // Only hide "Waiting on response" cards whose follow-up date hasn't arrived yet
      actions = data.filter((a: any) =>
        !(a.status === 'Waiting on response' && a.due_date && a.due_date > todayStr)
      )
    }
  } catch {
    // show empty state rather than crashing
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Your Outreach for Today</h1>
        <p className="text-sm text-gray-500 mt-0.5">{today}</p>
      </div>

      {actions.length > 0 ? (
        <>
          <p className="text-sm text-gray-600">
            You have <strong>{actions.length}</strong> {actions.length === 1 ? 'person' : 'people'} to reach out to.
          </p>
          <div className="space-y-3">
            {actions.map((action: any) => (
              <OutreachCard key={action.id} action={action} userId={user?.id ?? ''} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm">You're all caught up. No outreach items right now.</p>
          <p className="text-gray-400 text-xs mt-1">Check back after the admin assigns new outreach.</p>
        </div>
      )}
    </div>
  )
}
