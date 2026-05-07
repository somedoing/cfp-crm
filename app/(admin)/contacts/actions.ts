'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function deleteAllContacts() {
  const admin = createAdminClient()

  const { error: e1 } = await admin.from('interactions').delete().not('id', 'is', null)
  if (e1) return { error: e1.message }

  const { error: e2 } = await admin.from('actions').delete().not('id', 'is', null)
  if (e2) return { error: e2.message }

  const { error: e3 } = await admin.from('contacts').delete().not('id', 'is', null)
  if (e3) return { error: e3.message }

  revalidatePath('/contacts')
  return { success: true }
}
