import { createClient } from '@/lib/supabase/server'
import MergeWizard from '@/components/admin/MergeWizard'

const FIELDS = 'id, display_id, first_name, last_name, full_name, email, alternative_emails, phone, town, state, zip, county, source, original_source_form, notes, date_added, is_volunteer, is_active_volunteer, is_donor, is_signature_collector, is_supporter, is_media_contact, is_press_contact, is_coalition_contact, is_candidate_partner, newsletter_subscriber, email_opt_in, text_opt_in, in_discord, discord_username, volunteer_stage, donor_stage, signature_stage, priority, tags, do_not_contact'

async function fetchAll(supabase: Awaited<ReturnType<typeof createClient>>) {
  const all: any[] = []
  let page = 0
  while (true) {
    const { data } = await supabase
      .from('contacts')
      .select(FIELDS)
      .order('date_added', { ascending: true, nullsFirst: true })
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < 1000) break
    page++
  }
  return all
}

export default async function MergePage() {
  const supabase = await createClient()
  const contacts = await fetchAll(supabase)

  // Email duplicates
  const emailGroups = new Map<string, any[]>()
  for (const c of contacts) {
    if (!c.email?.trim()) continue
    const key = c.email.toLowerCase().trim()
    if (!emailGroups.has(key)) emailGroups.set(key, [])
    emailGroups.get(key)!.push(c)
  }

  // Name duplicates
  const nameGroups = new Map<string, any[]>()
  for (const c of contacts) {
    const first = (c.first_name ?? '').toLowerCase().trim()
    const last = (c.last_name ?? '').toLowerCase().trim()
    if (!first || !last) continue
    const key = `${first}|${last}`
    if (!nameGroups.has(key)) nameGroups.set(key, [])
    nameGroups.get(key)!.push(c)
  }

  const seenPairs = new Set<string>()
  const pairs: any[] = []

  function addPairs(groups: Map<string, any[]>, reason: string) {
    for (const group of groups.values()) {
      if (group.length < 2) continue
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const pairKey = [group[i].id, group[j].id].sort().join('|')
          if (seenPairs.has(pairKey)) continue
          seenPairs.add(pairKey)
          pairs.push({ key: pairKey, reason, a: group[i], b: group[j] })
        }
      }
    }
  }

  addPairs(emailGroups, 'email')
  addPairs(nameGroups, 'name')

  return <MergeWizard pairs={pairs as any} />
}
