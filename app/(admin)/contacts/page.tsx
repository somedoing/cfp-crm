import { createClient } from '@/lib/supabase/server'
import ContactsClient from '@/components/admin/ContactsClient'

const FIELDS = 'id, display_id, first_name, last_name, full_name, email, phone, town, state, is_volunteer, is_donor, is_signature_collector, is_press_contact, is_media_contact, volunteer_stage, donor_stage, priority, date_added, do_not_contact, tags'
const PAGE_SIZE = 1000 // Supabase API caps at 1,000 rows per request

async function fetchAllContacts(supabase: Awaited<ReturnType<typeof createClient>>) {
  const all: any[] = []
  let page = 0
  while (true) {
    const { data, error } = await supabase
      .from('contacts')
      .select(FIELDS)
      .order('date_added', { ascending: false, nullsFirst: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    page++
  }
  return all
}

export default async function ContactsPage() {
  const supabase = await createClient()

  const [contacts, { data: openActions }] = await Promise.all([
    fetchAllContacts(supabase),
    supabase
      .from('actions')
      .select('contact_id')
      .not('status', 'in', '("Done","Committed","Declined","Unresponsive","Dropped","Skipped")')
      .not('contact_id', 'is', null),
  ])

  const openContactIds = [...new Set(openActions?.map((a: any) => a.contact_id) ?? [])]

  return (
    <ContactsClient
      contacts={contacts as any}
      openContactIds={openContactIds}
    />
  )
}
