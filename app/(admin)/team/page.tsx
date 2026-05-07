import { createClient } from '@/lib/supabase/server'
import TeamManager from '@/components/admin/TeamManager'

export default async function TeamPage() {
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .order('role')
    .order('full_name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Team</h1>
        <p className="text-gray-500 mt-1">Manage who can access this CRM and what they can do.</p>
      </div>
      <TeamManager profiles={(profiles ?? []) as any} />
    </div>
  )
}
