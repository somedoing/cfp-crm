'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const VOLUNTEER_STAGES = [
  'New', 'Contacted', 'Interested', 'Asked', 'Assigned',
  'Active', 'Reliable', 'Lead', 'Paused', 'Inactive', 'Not a fit',
]

type ReviewContact = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  town: string | null
  state: string | null
  zip: string | null
  source: string | null
  original_source_form: string | null
  is_volunteer: boolean
  is_donor: boolean
  is_signature_collector: boolean
  is_press_contact: boolean
  is_media_contact: boolean
  is_candidate_partner: boolean
  is_supporter: boolean
  is_coalition_contact: boolean
  volunteer_stage: string | null
  donor_stage: string | null
  media_stage: string | null
  priority: string | null
  date_added: string | null
  notes: string | null
  do_not_contact: boolean
  newsletter_subscriber: boolean
  in_discord: boolean
}

function actionParams(contact: ReviewContact) {
  const today = new Date()
  let priority = 'Low'
  let dueDays = 7
  if (contact.date_added) {
    const added = new Date(contact.date_added)
    const daysSince = Math.floor((today.getTime() - added.getTime()) / 86400000)
    if (daysSince <= 7) { priority = 'High'; dueDays = 1 }
    else if (added.getFullYear() >= 2026) { priority = 'Medium'; dueDays = 3 }
  }
  const dueDate = new Date(today)
  dueDate.setDate(dueDate.getDate() + dueDays)
  return {
    contact_id: contact.id,
    title: `Follow up with ${contact.full_name}`,
    priority,
    action_type: 'Follow-up',
    action_area: 'General Supporter Follow-Up',
    assigned_to: 'admin',
    status: 'Needs Review',
    due_date: dueDate.toISOString().split('T')[0],
  }
}

export default function ReviewWizard({
  contacts,
  initialPipelineIds,
}: {
  contacts: ReviewContact[]
  initialPipelineIds: string[]
}) {
  const supabase = createClient()

  const [index, setIndex] = useState(0)
  const [pipelineIds, setPipelineIds] = useState(() => new Set(initialPipelineIds))
  const [showStages, setShowStages] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const savingRef = useRef(false)
  savingRef.current = saving

  const queue = contacts.filter(c => !pipelineIds.has(c.id))
  const contact = queue[index] ?? null
  const isComplete = index >= queue.length

  function advance() {
    setShowStages(false)
    setIndex(i => i + 1)
  }

  function goBack() {
    setShowStages(false)
    setLastAction(null)
    setIndex(i => Math.max(0, i - 1))
  }

  function flashThenAdvance(msg: string) {
    setLastAction(msg)
    setTimeout(() => {
      setLastAction(null)
      setShowStages(false)
      setIndex(i => i + 1)
    }, 700)
  }

  async function addToPipeline() {
    if (!contact || savingRef.current) return
    setSaving(true)
    setPipelineIds(prev => new Set([...prev, contact.id]))
    await supabase.from('actions').insert(actionParams(contact))
    setSaving(false)
    flashThenAdvance('Added to pipeline ✓')
  }

  async function setVolunteerStage(stage: string) {
    if (!contact || savingRef.current) return
    setSaving(true)
    setShowStages(false)
    await supabase.from('contacts').update({
      volunteer_stage: stage,
      is_volunteer: true,
      updated_at: new Date().toISOString(),
    }).eq('id', contact.id)
    setSaving(false)
    flashThenAdvance(`Volunteer: ${stage} ✓`)
  }

  async function markPoliticalAlly() {
    if (!contact || savingRef.current) return
    setSaving(true)
    await supabase.from('contacts').update({
      is_candidate_partner: true,
      updated_at: new Date().toISOString(),
    }).eq('id', contact.id)
    setSaving(false)
    flashThenAdvance('Political ally ✓')
  }

  async function markPress() {
    if (!contact || savingRef.current) return
    setSaving(true)
    await supabase.from('contacts').update({
      is_press_contact: true,
      is_media_contact: true,
      updated_at: new Date().toISOString(),
    }).eq('id', contact.id)
    setSaving(false)
    flashThenAdvance('Marked press/media ✓')
  }

  async function doNotContact() {
    if (!contact || savingRef.current) return
    setSaving(true)
    await supabase.from('contacts').update({
      do_not_contact: true,
      updated_at: new Date().toISOString(),
    }).eq('id', contact.id)
    setSaving(false)
    flashThenAdvance('Do not contact ✓')
  }

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (savingRef.current) return
      if (e.key === 'ArrowRight' || e.key === 'n') {
        setShowStages(false)
        setLastAction(null)
        setIndex(i => i + 1)
      }
      if (e.key === 'ArrowLeft' || e.key === 'p') {
        setShowStages(false)
        setLastAction(null)
        setIndex(i => Math.max(0, i - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">All caught up!</h2>
        <p className="text-gray-500 mb-6">
          You've reviewed all {queue.length === 0 ? contacts.length : index} contacts not already in the pipeline.
        </p>
        <Link href="/contacts" className="text-blue-600 hover:underline">← Back to contacts</Link>
      </div>
    )
  }

  if (!contact) return null

  const location = [contact.town, contact.state].filter(Boolean).join(', ')
  const progress = queue.length > 0 ? Math.round((index / queue.length) * 100) : 0

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/contacts" className="text-gray-500 hover:text-gray-900 text-sm">
          ← Back to contacts
        </Link>
        <span className="text-gray-600 font-medium">
          {index + 1} / {queue.length.toLocaleString()}
        </span>
        <span className="text-gray-400 text-xs">← → to navigate · N = next</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 items-start">
        {/* Contact card */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href={`/contacts/${contact.id}`}
                target="_blank"
                className="text-xl font-semibold text-blue-600 hover:underline"
              >
                {contact.full_name}
              </Link>
              {location && (
                <div className="text-gray-500 mt-0.5">
                  {location}{contact.zip ? ` ${contact.zip}` : ''}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              {contact.date_added && (
                <div className="text-gray-400 text-sm">Added {contact.date_added}</div>
              )}
              {contact.priority === 'High' && (
                <span className="text-red-500 text-sm font-medium">High priority</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {contact.email && (
              <div>
                <div className="text-gray-400 text-xs">Email</div>
                <div className="text-gray-800">{contact.email}</div>
              </div>
            )}
            {contact.phone && (
              <div>
                <div className="text-gray-400 text-xs">Phone</div>
                <div className="text-gray-800">{contact.phone}</div>
              </div>
            )}
            {contact.source && (
              <div>
                <div className="text-gray-400 text-xs">Source</div>
                <div className="text-gray-800">{contact.source}</div>
              </div>
            )}
            {contact.original_source_form && (
              <div>
                <div className="text-gray-400 text-xs">Form</div>
                <div className="text-gray-800 truncate">{contact.original_source_form}</div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {contact.is_volunteer && (
              <Badge variant="secondary">
                Volunteer{contact.volunteer_stage ? `: ${contact.volunteer_stage}` : ''}
              </Badge>
            )}
            {contact.is_donor && (
              <Badge variant="secondary">
                Donor{contact.donor_stage ? `: ${contact.donor_stage}` : ''}
              </Badge>
            )}
            {contact.is_signature_collector && <Badge variant="secondary">Sig collector</Badge>}
            {contact.is_supporter && <Badge variant="secondary">Supporter</Badge>}
            {contact.is_candidate_partner && (
              <Badge className="bg-purple-100 text-purple-700 border-purple-200">Political ally</Badge>
            )}
            {contact.is_press_contact && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200">Press</Badge>
            )}
            {contact.is_media_contact && !contact.is_press_contact && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200">Media</Badge>
            )}
            {contact.newsletter_subscriber && <Badge variant="secondary">Newsletter</Badge>}
            {contact.in_discord && <Badge variant="secondary">Discord</Badge>}
            {contact.is_coalition_contact && <Badge variant="secondary">Coalition</Badge>}
          </div>

          {contact.notes && (
            <div className="pt-3 border-t text-sm">
              <span className="text-gray-400">Notes: </span>
              <span className="text-gray-700">{contact.notes}</span>
            </div>
          )}
        </div>

        {/* Action panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-3">
            What to do?
          </p>

          <Button
            className="w-full justify-start bg-blue-600 hover:bg-blue-700"
            onClick={addToPipeline}
            disabled={saving}
          >
            + Add to pipeline
          </Button>

          {/* Volunteer stage dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => setShowStages(v => !v)}
              disabled={saving}
            >
              <span>Set volunteer stage</span>
              <span className="text-gray-400">{showStages ? '▲' : '▼'}</span>
            </Button>
            {showStages && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {VOLUNTEER_STAGES.map(stage => (
                  <button
                    key={stage}
                    onClick={() => setVolunteerStage(stage)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${
                      contact.volunteer_stage === stage ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={markPoliticalAlly}
            disabled={saving}
          >
            Political ally
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={markPress}
            disabled={saving}
          >
            Press / media
          </Button>

          <div className="border-t pt-3 mt-1 space-y-1.5">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-500 hover:text-gray-800"
              onClick={advance}
              disabled={saving}
            >
              Skip →
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-red-400 hover:text-red-600 hover:bg-red-50"
              onClick={doNotContact}
              disabled={saving}
            >
              Do not contact
            </Button>
          </div>

          <div className="border-t pt-3">
            <button
              onClick={goBack}
              disabled={index === 0}
              className="text-gray-400 hover:text-gray-600 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
          </div>

          {lastAction && (
            <div className="text-green-600 text-sm text-center pt-1">{lastAction}</div>
          )}
          {saving && (
            <div className="text-gray-400 text-sm text-center pt-1">Saving…</div>
          )}
        </div>
      </div>
    </div>
  )
}
