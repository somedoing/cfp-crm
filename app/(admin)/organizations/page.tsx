import { createClient } from '@/lib/supabase/server'
import OrganizationsClient from '@/components/admin/OrganizationsClient'
import Link from 'next/link'

export default async function OrganizationsPage() {
  const supabase = await createClient()

  const [{ data: orgs }, { data: openActions }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, org_type, town, state, region, outreach_stage, last_contact_date, notes')
      .order('name', { ascending: true }),
    supabase
      .from('actions')
      .select('org_id')
      .not('status', 'in', '("Done","Committed","Declined","Unresponsive","Dropped","Skipped")')
      .not('org_id', 'is', null),
  ])

  const openOrgIds = [...new Set(openActions?.map(a => a.org_id) ?? [])]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Organizations</h1>
          <p className="text-gray-500 mt-0.5">Track outreach to unions, nonprofits, and coalition partners.</p>
        </div>
        <Link
          href="/organizations/new"
          className="bg-gray-900 text-white rounded-lg px-4 py-2 hover:bg-gray-700 transition-colors"
        >
          + New org
        </Link>
      </div>
      <OrganizationsClient orgs={(orgs ?? []) as any} openOrgIds={openOrgIds} />
    </div>
  )
}
