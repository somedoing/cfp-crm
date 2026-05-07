'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Contact = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  town: string | null
  state: string | null
  notes: string | null
  last_contact_summary: string | null
  volunteer_stage: string | null
  donor_stage: string | null
}

type Interaction = {
  id: string
  interaction_date: string | null
  interaction_type: string | null
  direction: string | null
  summary: string | null
  notes: string | null
  created_at: string
}

export default function SenderContactView({
  contact,
  interactions: initialInteractions,
}: {
  contact: Contact
  interactions: Interaction[]
}) {
  const supabase = createClient()
  const router = useRouter()

  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [interactions, setInteractions] = useState(initialInteractions)

  const location = [contact.town, contact.state].filter(Boolean).join(', ')

  async function addNote() {
    if (!note.trim()) return
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('interactions')
      .insert({
        contact_id: contact.id,
        interaction_type: 'Internal note',
        direction: 'Outbound',
        interaction_date: today,
        owner: 'sender',
        summary: note.trim(),
      })
      .select('id, interaction_date, interaction_type, direction, summary, notes, created_at')
      .single()

    if (data) setInteractions(prev => [data as Interaction, ...prev])
    setNote('')
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => router.back()}
        className="text-gray-500 hover:text-gray-900 text-sm"
      >
        ← Back
      </button>

      {/* Contact card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h1 className="text-xl font-semibold text-gray-900">{contact.full_name}</h1>

        <div className="space-y-1 text-sm">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="block text-blue-600 hover:underline">
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="block text-gray-700">
              {contact.phone}
            </a>
          )}
          {location && <div className="text-gray-500">{location}</div>}
        </div>

        {(contact.volunteer_stage || contact.donor_stage) && (
          <div className="flex gap-3 text-sm pt-1">
            {contact.volunteer_stage && (
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                Volunteer: {contact.volunteer_stage}
              </span>
            )}
            {contact.donor_stage && (
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                Donor: {contact.donor_stage}
              </span>
            )}
          </div>
        )}

        {contact.last_contact_summary && (
          <div className="pt-2 border-t text-sm">
            <span className="text-gray-400">Last contact: </span>
            <span className="text-gray-700">{contact.last_contact_summary}</span>
          </div>
        )}

        {contact.notes && (
          <div className="pt-2 border-t text-sm">
            <span className="text-gray-400">Notes from admin: </span>
            <span className="text-gray-700">{contact.notes}</span>
          </div>
        )}
      </div>

      {/* Add note */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Add a note</h2>
        <Textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What happened? What did they say?"
          className="resize-none h-24 text-sm"
        />
        <Button onClick={addNote} disabled={saving || !note.trim()} size="sm">
          {saving ? 'Saving…' : 'Save note'}
        </Button>
      </div>

      {/* Note history */}
      {interactions.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-gray-800">History</h2>
          {interactions.map(int => (
            <div key={int.id} className="bg-white rounded-lg border border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <span>{int.interaction_type}</span>
                {int.direction && <span>· {int.direction}</span>}
                <span className="ml-auto">
                  {int.interaction_date ?? int.created_at.split('T')[0]}
                </span>
              </div>
              {int.summary && <p className="text-sm text-gray-800">{int.summary}</p>}
              {int.notes && <p className="text-sm text-gray-400 italic mt-0.5">{int.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
