import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import MergeContacts from '@/components/admin/MergeContacts'

export default async function MergePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, display_id, first_name, last_name, full_name, email, phone, town, state, zip, source, date_added, volunteer_stage, donor_stage, priority, notes, is_volunteer, is_donor, is_signature_collector, is_candidate_partner, is_press_contact, is_media_contact, newsletter_subscriber, in_discord')
    .eq('id', id)
    .single()

  if (!contact) notFound()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Merge duplicate contact</h1>
        <p className="text-gray-500 mt-1">
          Search for the duplicate. The current contact survives; the duplicate's data fills any blanks, then it's deleted.
        </p>
      </div>
      <MergeContacts primary={contact as any} />
    </div>
  )
}
