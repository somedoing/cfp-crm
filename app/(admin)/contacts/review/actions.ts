'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// One-time cleanup: strip stale tags and re-apply correct tags from flags.
// Safe to run multiple times — it won't duplicate tags.
export async function retag() {
  const admin = createAdminClient()

  const contacts: any[] = []
  let page = 0
  while (true) {
    const { data, error } = await admin
      .from('contacts')
      .select('id, date_added, original_source_form, tags, is_volunteer, is_donor, is_signature_collector, newsletter_subscriber, is_media_contact, is_press_contact')
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (error) return { error: error.message }
    if (!data || data.length === 0) break
    contacts.push(...data)
    if (data.length < 1000) break
    page++
  }

  const STALE_TAGS = new Set([
    'Jon Kiper Supporter', 'Past Donor', 'Lapsed Donor', 'High-Priority Donor',
    'Small-Dollar Donor', 'Volunteer Signup', 'Old Volunteer Signup', 'Active Volunteer',
    'Past Volunteer', 'Org Contact', 'Media / Influencer Contact', 'Community First Party Interest',
  ])

  let updated = 0
  for (const c of contacts) {
    const existing: string[] = Array.isArray(c.tags) ? c.tags : []

    // Strip stale tags
    const clean = existing.filter(t => !STALE_TAGS.has(t))

    // Compute correct tags
    const year = c.date_added ? new Date(c.date_added).getFullYear() : null
    const suffix = year ? ` ${year}` : ''
    const sourceForm = c.original_source_form ?? ''
    const correct: string[] = []

    if (c.newsletter_subscriber) correct.push('Newsletter')
    if (sourceForm === 'Pledge Form') {
      correct.push(`CFP Pledge${suffix}`)
    } else if (c.is_volunteer) {
      correct.push(`Volunteer Form${suffix}`)
    }
    if (c.is_signature_collector) correct.push(`Sig Collector${suffix}`)
    if (c.is_donor) correct.push(`One-Time Donor${suffix}`)
    if (c.is_media_contact || c.is_press_contact) correct.push('Press')

    // Merge, preserving any manually-added tags (Coalition, Recurring Donor, etc.)
    const merged = [...new Set([...clean, ...correct])]

    const changed =
      merged.length !== existing.length ||
      merged.some(t => !existing.includes(t)) ||
      existing.some(t => !merged.includes(t))

    if (changed) {
      await admin.from('contacts').update({ tags: merged }).eq('id', c.id)
      updated++
    }
  }

  return { updated, total: contacts.length }
}
