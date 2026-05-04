'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

type Contact = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  town: string | null
  state: string | null
  is_volunteer: boolean
  is_donor: boolean
  is_signature_collector: boolean
  volunteer_stage: string | null
  donor_stage: string | null
  priority: string | null
  date_added: string | null
  do_not_contact: boolean
}

export default function ContactsClient({
  contacts,
  openContactIds,
}: {
  contacts: Contact[]
  openContactIds: string[]
}) {
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'volunteer' | 'donor' | 'sig'>('all')
  const [outreachFilter, setOutreachFilter] = useState<'needs' | 'all'>('needs')
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)

  const openIds = useMemo(
    () => new Set([...openContactIds, ...addedIds]),
    [openContactIds, addedIds]
  )

  const needsOutreachCount = useMemo(
    () => contacts.filter(c => !c.do_not_contact && !openIds.has(c.id)).length,
    [contacts, openIds]
  )

  const filtered = useMemo(() => {
    let result = contacts.filter(c => !c.do_not_contact)

    if (outreachFilter === 'needs') result = result.filter(c => !openIds.has(c.id))

    if (typeFilter === 'volunteer') result = result.filter(c => c.is_volunteer)
    if (typeFilter === 'donor') result = result.filter(c => c.is_donor)
    if (typeFilter === 'sig') result = result.filter(c => c.is_signature_collector)

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        c =>
          c.full_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.town?.toLowerCase().includes(q)
      )
    }

    return result
  }, [contacts, search, typeFilter, outreachFilter, openIds])

  async function addToPipeline(contact: Contact) {
    setAdding(contact.id)

    const today = new Date()
    let priority = 'Low'
    let dueDays = 7

    if (contact.date_added) {
      const added = new Date(contact.date_added)
      const daysSince = Math.floor((today.getTime() - added.getTime()) / 86400000)
      if (daysSince <= 7) {
        priority = 'High'
        dueDays = 1
      } else if (added.getFullYear() >= 2026) {
        priority = 'Medium'
        dueDays = 3
      }
    }

    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() + dueDays)

    await supabase.from('actions').insert({
      contact_id: contact.id,
      title: `Follow up with ${contact.full_name}`,
      priority,
      action_type: 'Follow-up',
      action_area: 'General Supporter Follow-Up',
      assigned_to: 'admin',
      status: 'Not started',
      due_date: dueDate.toISOString().split('T')[0],
    })

    setAddedIds(prev => new Set([...prev, contact.id]))
    setAdding(null)
  }

  const typeOptions = [
    { key: 'all', label: 'All' },
    { key: 'volunteer', label: 'Volunteers' },
    { key: 'donor', label: 'Donors' },
    { key: 'sig', label: 'Signature' },
  ] as const

  const visible = filtered.slice(0, 150)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
          {outreachFilter === 'needs' && (
            <p className="text-gray-500 mt-0.5">
              {needsOutreachCount.toLocaleString()} contacts need outreach
            </p>
          )}
        </div>
        <span className="text-gray-500">{filtered.length.toLocaleString()} shown</span>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search name, email, town…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 min-w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="flex gap-1">
          {typeOptions.map(o => (
            <button
              key={o.key}
              onClick={() => setTypeFilter(o.key)}
              className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                typeFilter === o.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setOutreachFilter('needs')}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              outreachFilter === 'needs'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Needs outreach
          </button>
          <button
            onClick={() => setOutreachFilter('all')}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              outreachFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Town</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Added</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map(contact => {
              const inPipeline = openIds.has(contact.id)
              const justAdded = addedIds.has(contact.id)
              const location = [contact.town, contact.state].filter(Boolean).join(', ')

              return (
                <tr key={contact.id} className={`hover:bg-gray-50 ${justAdded ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {contact.full_name}
                    </Link>
                    {contact.priority === 'High' && (
                      <span className="ml-2 text-red-500 font-medium">·· High</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{contact.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{location || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {contact.is_volunteer && <Badge variant="secondary">Vol</Badge>}
                      {contact.is_donor && <Badge variant="secondary">Donor</Badge>}
                      {contact.is_signature_collector && <Badge variant="secondary">Sig</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{contact.date_added ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {inPipeline ? (
                      <span className="text-gray-400">In pipeline</span>
                    ) : (
                      <button
                        onClick={() => addToPipeline(contact)}
                        disabled={adding === contact.id}
                        className="bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {adding === contact.id ? '…' : '+ Add'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">No contacts match these filters.</div>
        )}
        {filtered.length > 150 && (
          <div className="text-center py-4 text-gray-400 border-t">
            Showing 150 of {filtered.length.toLocaleString()} — use search or filters to narrow down
          </div>
        )}
      </div>
    </div>
  )
}
