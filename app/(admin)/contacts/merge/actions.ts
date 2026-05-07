'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

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

  revalidatePath('/contacts')
  revalidatePath('/contacts/merge')
  return { success: true }
}
