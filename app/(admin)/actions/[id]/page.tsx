import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ActionEditor from '@/components/admin/ActionEditor'

export default async function ActionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: action } = await supabase
    .from('actions')
    .select('*, contact:contacts(id, full_name, display_id, email, phone, town, state, date_added, volunteer_stage, donor_stage, signature_stage, notes, last_contact_summary)')
    .eq('id', id)
    .single()

  if (!action) notFound()

  return <ActionEditor action={action} />
}
