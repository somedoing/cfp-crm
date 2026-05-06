import { createClient } from '@/lib/supabase/server'
import ReviewWizard from '@/components/admin/ReviewWizard'

const FIELDS = 'id, full_name, email, phone, town, state, zip, source, original_source_form, is_volunteer, is_donor, is_signature_collector, is_press_contact, is_media_contact, is_candidate_partner, is_supporter, is_coalition_contact, volunteer_stage, donor_stage, media_stage, priority, date_added, notes, do_not_contact, newsletter_subscriber, in_discord'

async function fetchAll(supabase: Awaited<ReturnType<typeof createClient>>) {
  const all: any[] = []
  let page = 0
  while (true) {
    const { data } = await supabase
      .from('contacts')
      .select(FIELDS)
      .eq('do_not_contact', false)
      .order('date_added', { ascending: false, nullsFirst: false })
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < 1000) break
    page++
  }
  return all
}

export default async function ReviewPage() {
  const supabase = await createClient()

  const [contacts, { data: openActions }] = await Promise.all([
    fetchAll(supabase),
    supabase
      .from('actions')
      .select('contact_id')
      .not('status', 'in', '("Done","Committed","Declined","Unresponsive","Dropped","Skipped")')
      .not('contact_id', 'is', null),
  ])

  const openContactIds = [...new Set(openActions?.map((a: any) => a.contact_id) ?? [])]

  return (
    <ReviewWizard
      contacts={contacts as any}
      initialPipelineIds={openContactIds}
    />
  )
}
