'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createUser(email: string, fullName: string, password: string, role: string) {
  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || email, role },
  })

  if (error) return { error: error.message }

  // Upsert profile with the correct role
  if (data.user) {
    const { error: profileError } = await admin.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: fullName || email,
      role,
    })
    if (profileError) return { error: profileError.message }
  }

  revalidatePath('/team')
  return {
    success: true,
    profile: {
      id: data.user!.id,
      email,
      full_name: fullName || email,
      role: role as 'admin' | 'sender',
    },
  }
}

export async function updateUserRole(userId: string, role: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ role }).eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/team')
  return { success: true }
}
