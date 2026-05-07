'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function inviteUser(email: string, fullName: string, role: string) {
  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName || email, role },
  })

  if (error) return { error: error.message }

  // Upsert profile with the correct role (the trigger may create it with default 'sender')
  if (data.user) {
    await admin.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: fullName || email,
      role,
    })
  }

  revalidatePath('/team')
  return { success: true }
}

export async function updateUserRole(userId: string, role: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ role }).eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/team')
  return { success: true }
}
