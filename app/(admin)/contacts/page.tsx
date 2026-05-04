import { createClient } from '@/lib/supabase/server'
import ContactsClient from '@/components/admin/ContactsClient'

export default async function ContactsPage() {
  const supabase = await createClient()

  const [{ data: contacts }, { data: openActions }] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, full_name, email, phone, town, state, is_volunteer, is_donor, is_signature_collector, volunteer_stage, donor_stage, priority, date_added, do_not_contact')
      .order('date_added', { ascending: false, nullsFirst: false })
      .limit(5000),
    supabase
      .from('actions')
      .select('contact_id')
      .not('status', 'in', '("Done","Committed","Declined","Unresponsive","Dropped","Skipped")')
      .not('contact_id', 'is', null),
  ])

  const openContactIds = [...new Set(openActions?.map(a => a.contact_id) ?? [])]

  return (
    <ContactsClient
      contacts={(contacts ?? []) as any}
      openContactIds={openContactIds}
    />
  )
}
