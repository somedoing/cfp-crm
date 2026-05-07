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

  await admin.from('actions').update({ contact_id: primaryId }).eq('contact_id', secondaryId)
  await admin.from('interactions').update({ contact_id: primaryId }).eq('contact_id', secondaryId)

  const { error } = await admin
    .from('contacts')
    .update({ ...mergedData, updated_at: new Date().toISOString() })
    .eq('id', primaryId)
  if (error) return { error: error.message }

  await admin.from('contacts').delete().eq('id', secondaryId)

  revalidatePath('/contacts')
  revalidatePath('/contacts/merge')
  return { success: true }
}
