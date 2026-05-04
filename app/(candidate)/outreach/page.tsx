import { createClient } from '@/lib/supabase/server'
import OutreachCard from '@/components/candidate/OutreachCard'

export default async function OutreachPage() {
  const supabase = await createClient()

  const { data: actions } = await supabase
    .from('actions')
    .select('*, contact:contacts(full_name, display_id, email, phone, last_contact_summary, notes)')
    .eq('assigned_to', 'candidate')
    .not('status', 'in', '("Done","Dropped","Skipped")')
    .order('priority', { ascending: true })
    .order('due_date', { ascending: true })

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Your Outreach for Today</h1>
        <p className="text-sm text-gray-500 mt-0.5">{today}</p>
      </div>

      {actions && actions.length > 0 ? (
        <>
          <p className="text-sm text-gray-600">
            You have <strong>{actions.length}</strong> {actions.length === 1 ? 'person' : 'people'} to reach out to.
          </p>
          <div className="space-y-3">
            {actions.map((action: any) => (
              <OutreachCard key={action.id} action={action} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm">You're all caught up. No outreach items right now.</p>
          <p className="text-gray-400 text-xs mt-1">Check back after the admin processes new imports.</p>
        </div>
      )}
    </div>
  )
}
