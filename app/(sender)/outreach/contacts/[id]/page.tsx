import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SenderContactView from '@/components/sender/SenderContactView'

export default async function SenderContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: contact }, { data: interactions }] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, full_name, email, phone, town, state, notes, last_contact_summary, volunteer_stage, donor_stage')
      .eq('id', id)
      .single(),
    supabase
      .from('interactions')
      .select('id, interaction_date, interaction_type, direction, summary, notes, created_at')
      .eq('contact_id', id)
      .order('interaction_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (!contact) notFound()

  return (
    <SenderContactView
      contact={contact as any}
      interactions={(interactions ?? []) as any}
    />
  )
}
