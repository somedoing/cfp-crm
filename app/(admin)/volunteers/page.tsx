import { createClient } from '@/lib/supabase/server'
import VolunteersClient from '@/components/admin/VolunteersClient'

const FIELDS = [
  'id', 'full_name', 'first_name', 'last_name',
  'email', 'phone', 'town', 'state',
  'volunteer_stage', 'is_active_volunteer', 'is_signature_collector',
  'last_contact_date', 'last_contact_summary',
  'notes', 'date_added', 'priority',
  'in_discord', 'discord_stage', 'discord_username',
  'tags',
].join(', ')

export default async function VolunteersPage() {
  const supabase = await createClient()

  const { data: volunteers } = await supabase
    .from('contacts')
    .select(FIELDS)
    .eq('is_volunteer', true)
    .order('date_added', { ascending: true, nullsFirst: true })

  return <VolunteersClient volunteers={(volunteers ?? []) as any} />
}
