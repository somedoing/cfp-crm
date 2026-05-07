'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const FIELDS = 'id, display_id, first_name, last_name, full_name, email, alternative_emails, phone, town, state, zip, county, source, original_source_form, notes, date_added, is_volunteer, is_active_volunteer, is_donor, is_signature_collector, is_supporter, is_media_contact, is_press_contact, is_coalition_contact, is_candidate_partner, newsletter_subscriber, email_opt_in, text_opt_in, in_discord, discord_username, volunteer_stage, donor_stage, signature_stage, priority, tags, do_not_contact'

export async function fetchDuplicatePairs() {
  const admin = createAdminClient()

  // Fetch all contacts — admin client bypasses RLS, range covers up to 50k
  const { data: contacts, error } = await admin
    .from('contacts')
    .select(FIELDS)
    .order('id', { ascending: true })
    .range(0, 49999)

  if (error) return { error: error.message, pairs: [] }
  if (!contacts) return { pairs: [] }

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

  return { pairs }
}

export async function mergeContacts({
  primaryId,
  secondaryId,
  mergedData,
}: {
  primaryId: string
  secondaryId: string
  mergedData: Record<string, unknown>
}) {
  const admin = createAdminClient()

  const { error: actionsErr } = await admin
    .from('actions')
    .update({ contact_id: primaryId })
    .eq('contact_id', secondaryId)
  if (actionsErr) return { error: `Failed to move actions: ${actionsErr.message}` }

  const { error: interactionsErr } = await admin
    .from('interactions')
    .update({ contact_id: primaryId })
    .eq('contact_id', secondaryId)
  if (interactionsErr) return { error: `Failed to move interactions: ${interactionsErr.message}` }

  // Strip alternative_emails if column doesn't exist yet — try with, fall back without
  const { error: updateErr } = await admin
    .from('contacts')
    .update({ ...mergedData, updated_at: new Date().toISOString() })
    .eq('id', primaryId)

  if (updateErr) {
    // If failure is about alternative_emails column not existing, retry without it
    if (updateErr.message.includes('alternative_emails')) {
      const { alternative_emails: _drop, ...rest } = mergedData
      const { error: retryErr } = await admin
        .from('contacts')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', primaryId)
      if (retryErr) return { error: `Failed to update contact: ${retryErr.message}` }
    } else {
      return { error: `Failed to update contact: ${updateErr.message}` }
    }
  }

  const { error: deleteErr, count } = await admin
    .from('contacts')
    .delete({ count: 'exact' })
    .eq('id', secondaryId)
  if (deleteErr) return { error: `Failed to delete duplicate: ${deleteErr.message}` }
  if (count === 0) return { error: `Delete matched 0 rows — contact ${secondaryId} may already be deleted or a trigger is blocking it` }

  // Verify the contact is actually gone
  const { data: stillExists } = await admin
    .from('contacts')
    .select('id')
    .eq('id', secondaryId)
    .maybeSingle()
  if (stillExists) return { error: `Contact ${secondaryId} still exists after delete — a database trigger may be blocking deletion` }

  revalidatePath('/contacts')
  revalidatePath('/contacts/merge')
  return { success: true }
}
