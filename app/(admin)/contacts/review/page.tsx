import { createClient } from '@/lib/supabase/server'
import ReviewWizard from '@/components/admin/ReviewWizard'

const FIELDS = 'id, display_id, first_name, last_name, full_name, email, phone, town, state, zip, county, source, original_source_form, is_volunteer, is_active_volunteer, is_donor, is_signature_collector, is_press_contact, is_media_contact, is_candidate_partner, is_supporter, is_coalition_contact, email_opt_in, text_opt_in, newsletter_subscriber, in_discord, discord_username, volunteer_stage, donor_stage, signature_stage, discord_stage, media_stage, priority, date_added, notes, do_not_contact, reviewed_at'

async function fetchAll(supabase: Awaited<ReturnType<typeof createClient>>) {
  const all: any[] = []
  let page = 0
  while (true) {
    const { data } = await supabase
      .from('contacts')
      .select(FIELDS)
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

  const [contacts, { data: openActions }, { data: profiles }, { data: taskTemplates }] = await Promise.all([
    fetchAll(supabase),
    supabase
      .from('actions')
      .select('contact_id')
      .not('status', 'in', '("Done","Committed","Declined","Unresponsive","Dropped","Skipped")')
      .not('contact_id', 'is', null),
    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name'),
    supabase
      .from('task_templates')
      .select('id, title, description, suggested_ask, suggested_message, action_type, action_area, priority')
      .order('title'),
  ])

  const openContactIds = [...new Set(openActions?.map((a: any) => a.contact_id) ?? [])]

  return (
    <ReviewWizard
      contacts={contacts as any}
      initialPipelineIds={openContactIds}
      users={(profiles ?? []) as any}
      templates={(taskTemplates ?? []) as any}
    />
  )
}
