import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { count: newImports },
    { count: overdueActions },
    { count: uncontactedVolunteers },
    { count: needsThankYou },
    { count: shouldInviteDiscord },
    { count: candidateQueue },
    { data: recentActions },
  ] = await Promise.all([
    supabase.from('imports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('actions').select('*', { count: 'exact', head: true })
      .lt('due_date', today).not('status', 'in', '("Done","Dropped","Skipped")'),
    supabase.from('contacts').select('*', { count: 'exact', head: true })
      .eq('is_volunteer', true).eq('volunteer_stage', 'New'),
    supabase.from('contacts').select('*', { count: 'exact', head: true })
      .eq('is_donor', true).eq('donor_stage', 'Donated'),
    supabase.from('contacts').select('*', { count: 'exact', head: true })
      .eq('discord_stage', 'Should invite'),
    supabase.from('actions').select('*', { count: 'exact', head: true })
      .eq('assigned_to', 'sender').not('status', 'in', '("Done","Dropped","Skipped")'),
    supabase.from('actions')
      .select('*, contact:contacts(full_name, display_id)')
      .not('status', 'in', '("Done","Dropped","Skipped")')
      .order('due_date', { ascending: true })
      .limit(8),
  ])

  const stats = [
    { label: 'Pending Imports', value: newImports ?? 0, href: '/imports', urgent: (newImports ?? 0) > 0 },
    { label: 'Overdue Actions', value: overdueActions ?? 0, href: '/actions', urgent: (overdueActions ?? 0) > 0 },
    { label: 'New Volunteer Leads', value: uncontactedVolunteers ?? 0, href: '/contacts?volunteer_stage=New', urgent: false },
    { label: 'Donors Need Thank-You', value: needsThankYou ?? 0, href: '/contacts?donor_stage=Donated', urgent: (needsThankYou ?? 0) > 0 },
    { label: 'Discord Invites Needed', value: shouldInviteDiscord ?? 0, href: '/contacts?discord_stage=Should+invite', urgent: false },
    { label: "Sender Queue", value: candidateQueue ?? 0, href: '/actions?assigned_to=sender', urgent: false },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map(stat => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-gray-900">{stat.value}</span>
                  {stat.urgent && stat.value > 0 && (
                    <Badge variant="destructive">Needs attention</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Upcoming Actions</CardTitle>
            <Link href="/actions" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentActions && recentActions.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {recentActions.map((action: any) => (
                <div key={action.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{action.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {action.contact?.full_name ?? 'No contact'} · {action.action_type} · {action.action_area}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {action.priority === 'High' && <Badge variant="destructive">High</Badge>}
                    {action.due_date && (
                      <span className={`text-xs ${action.due_date < today ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {action.due_date < today ? 'Overdue' : action.due_date}
                      </span>
                    )}
                    <Badge variant={action.assigned_to === 'sender' ? 'default' : 'secondary'}>
                      {action.assigned_to === 'sender' ? 'Sender' : 'Admin'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">No upcoming actions. Import some contacts to get started.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
