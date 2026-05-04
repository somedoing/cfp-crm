import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('contacts')
    .select('id, display_id, full_name, email, phone, town, volunteer_stage, donor_stage, is_volunteer, is_donor, is_signature_collector, priority, last_contact_date, do_not_contact')
    .order('created_at', { ascending: false })
    .limit(100)

  if (params.volunteer_stage) query = query.eq('volunteer_stage', params.volunteer_stage)
  if (params.donor_stage) query = query.eq('donor_stage', params.donor_stage)
  if (params.discord_stage) query = query.eq('discord_stage', params.discord_stage)

  const { data: contacts } = await query

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
        <span className="text-sm text-gray-500">{contacts?.length ?? 0} shown</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email / Phone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Town</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Roles</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Vol. Stage</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Last Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts?.map(contact => (
              <tr key={contact.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/contacts/${contact.id}`} className="font-medium text-blue-600 hover:underline">
                    {contact.full_name}
                  </Link>
                  <div className="text-xs text-gray-400">{contact.display_id}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <div>{contact.email}</div>
                  <div className="text-xs text-gray-400">{contact.phone}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{contact.town}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {contact.is_volunteer && <Badge variant="secondary" className="text-xs">Vol</Badge>}
                    {contact.is_donor && <Badge variant="secondary" className="text-xs">Donor</Badge>}
                    {contact.is_signature_collector && <Badge variant="secondary" className="text-xs">Sig</Badge>}
                    {contact.do_not_contact && <Badge variant="destructive" className="text-xs">DNC</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {contact.volunteer_stage && (
                    <span className="text-xs text-gray-600">{contact.volunteer_stage}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {contact.last_contact_date ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!contacts || contacts.length === 0) && (
          <div className="text-center py-12 text-sm text-gray-500">
            No contacts yet. <Link href="/imports" className="text-blue-600 hover:underline">Import a CSV</Link> to get started.
          </div>
        )}
      </div>
    </div>
  )
}
