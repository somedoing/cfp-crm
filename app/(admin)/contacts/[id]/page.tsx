import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ContactDetail from '@/components/admin/ContactDetail'

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: contact }, { data: actions }, { data: interactions }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', id).single(),
    supabase
      .from('actions')
      .select('id, title, status, priority, action_type, action_area, due_date, sent_at, completed_date, notes, created_at')
      .eq('contact_id', id)
      .order('due_date', { ascending: false, nullsFirst: false }),
    supabase
      .from('interactions')
      .select('id, interaction_date, interaction_type, direction, summary, result, notes, created_at')
      .eq('contact_id', id)
      .order('interaction_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (!contact) notFound()

  return (
    <ContactDetail
      contact={contact as any}
      actions={(actions ?? []) as any}
      interactions={(interactions ?? []) as any}
    />
  )
}
