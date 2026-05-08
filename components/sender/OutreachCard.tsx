'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'

type Contact = {
  full_name: string | null
  display_id: string | null
  email: string | null
  phone: string | null
  notes: string | null
  tags: string[] | null
  date_added: string | null
  town: string | null
  state: string | null
  volunteer_stage: string | null
  donor_stage: string | null
  original_source_form: string | null
  is_volunteer: boolean
  is_donor: boolean
  is_signature_collector: boolean
}

type Props = {
  action: {
    id: string
    contact_id: string
    action_type: string
    action_area: string | null
    suggested_ask: string | null
    suggested_message: string | null
    notes: string | null
    priority: string
    status: string
    contact: Contact
  }
  userId: string
}

type LastInteraction = {
  interaction_date: string
  summary: string | null
  interaction_type: string
}

const OUTCOMES = ['Yes', 'Maybe', 'No', 'No response', 'Needs more info', 'Wrong contact', 'Do not contact']

function daysAgoLabel(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}yr ago`
}

function randomFollowUpDate() {
  const days = 3 + Math.floor(Math.random() * 3) // 3, 4, or 5
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function stageUpdatesForOutreach(contact: Contact) {
  const updates: Record<string, string> = {}
  if (contact.is_volunteer && (!contact.volunteer_stage || contact.volunteer_stage === 'New')) {
    updates.volunteer_stage = 'Contacted'
  }
  if (contact.is_donor && (!contact.donor_stage || ['Prospect', 'Not asked'].includes(contact.donor_stage))) {
    updates.donor_stage = 'Asked'
  }
  return updates
}

function stageUpdatesForOutcome(outcome: string, contact: Contact) {
  const updates: Record<string, unknown> = {}
  if (outcome === 'Do not contact') {
    updates.do_not_contact = true
    return updates
  }
  if (['Yes', 'Maybe'].includes(outcome)) {
    if (contact.is_volunteer) updates.volunteer_stage = 'Interested'
    if (contact.is_donor) updates.donor_stage = 'Pledged'
  } else if (outcome === 'No') {
    if (contact.is_volunteer) updates.volunteer_stage = 'Not a fit'
    if (contact.is_donor) updates.donor_stage = 'Lapsed'
  }
  return updates
}

export default function OutreachCard({ action, userId }: Props) {
  const supabase = createClient()
  const { contact } = action

  const [mode, setMode] = useState<'idle' | 'responded' | 'done'>('idle')
  const [outcome, setOutcome] = useState('')
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState(false)
  const [followUpDate, setFollowUpDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  const [last, setLast] = useState<LastInteraction | null>(null)

  useEffect(() => {
    supabase
      .from('interactions')
      .select('interaction_date, summary, interaction_type')
      .eq('contact_id', action.contact_id)
      .in('interaction_type', ['Email', 'Call', 'Text', 'In-person', 'Meeting'])
      .order('interaction_date', { ascending: false })
      .limit(1)
      .then(({ data }) => { if (data?.[0]) setLast(data[0]) })
  }, [action.contact_id])

  const interactionType = action.action_type === 'Call' ? 'Call' : action.action_type === 'Text' ? 'Text' : 'Email'
  const actionLabel = action.action_type === 'Call' ? 'Called them' : action.action_type === 'Text' ? 'Texted them' : 'Emailed them'
  const isFollowUp = action.status === 'Waiting on response'

  // Log outreach sent — card disappears until follow-up date
  async function logOutreach() {
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const followUpDue = randomFollowUpDate()

    await supabase.from('actions').update({
      status: 'Waiting on response',
      due_date: followUpDue,
    }).eq('id', action.id)

    await supabase.from('interactions').insert({
      contact_id: action.contact_id,
      action_id: action.id,
      interaction_date: today,
      interaction_type: interactionType,
      direction: 'Outbound',
      owner: 'sender',
      summary: `${actionLabel} — awaiting response`,
    })

    const stageUpdates = stageUpdatesForOutreach(contact)
    if (Object.keys(stageUpdates).length > 0) {
      await supabase.from('contacts').update(stageUpdates).eq('id', action.contact_id)
    }

    setSaving(false)
    setMode('done')
  }

  // Log a response from the contact — mark done, update pipeline
  async function logResponse() {
    if (!outcome) return
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]

    await supabase.from('actions').update({
      status: 'Done',
      outcome,
      completed_date: today,
      follow_up_needed: followUp,
      follow_up_date: followUpDate || null,
    }).eq('id', action.id)

    await supabase.from('interactions').insert({
      contact_id: action.contact_id,
      action_id: action.id,
      interaction_date: today,
      interaction_type: interactionType,
      direction: 'Inbound',
      owner: 'sender',
      summary: notes || `Response: ${outcome}`,
      result: outcome,
      follow_up_needed: followUp,
      follow_up_date: followUpDate || null,
    })

    if (followUp && followUpDate) {
      await supabase.from('actions').insert({
        contact_id: action.contact_id,
        action_area: action.action_area,
        action_type: 'Follow-up',
        title: `Follow up with ${contact.full_name}`,
        assigned_to: 'sender',
        assigned_user_id: userId,
        priority: action.priority,
        status: 'Not started',
        due_date: followUpDate,
      })
    }

    const stageUpdates = stageUpdatesForOutcome(outcome, contact)
    if (Object.keys(stageUpdates).length > 0) {
      await supabase.from('contacts').update(stageUpdates).eq('id', action.contact_id)
    }

    setSaving(false)
    setMode('done')
  }

  if (mode === 'done') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 opacity-40 flex items-center justify-between">
        <span className="font-medium text-gray-700">{contact.full_name}</span>
        <span className="text-xs text-green-600 font-medium">Logged ✓</span>
      </div>
    )
  }

  const location = [contact.town, contact.state].filter(Boolean).join(', ')
  const tags = (contact.tags ?? []).filter(Boolean)
  const addedYear = contact.date_added ? new Date(contact.date_added).getFullYear() : null
  const actionTypeIcon = action.action_type === 'Call' ? '📞' : action.action_type === 'Text' ? '💬' : '✉️'

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${isFollowUp ? 'border-amber-200' : 'border-gray-200'}`}>

      {/* Follow-up banner */}
      {isFollowUp && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2">
          <p className="text-xs font-medium text-amber-700">↩ Follow-up — no response yet</p>
        </div>
      )}

      {/* Contact header */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/outreach/contacts/${action.contact_id}`}
            className="font-semibold text-gray-900 hover:text-blue-600 text-base leading-tight"
          >
            {contact.full_name ?? '(no name)'}
          </Link>
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
              action.priority === 'High' ? 'bg-red-100 text-red-600' :
              action.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-500'
            }`}>{action.priority}</span>
            <span className="text-sm">{actionTypeIcon}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="text-gray-700 hover:text-gray-900">{contact.phone}</a>
            )}
          </div>
          {(location || addedYear) && (
            <p className="text-xs text-gray-400">
              {[location, addedYear ? `Since ${addedYear}` : null].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map(t => (
              <span key={t} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">{t}</span>
            ))}
          </div>
        )}

        {last ? (
          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-xs text-gray-400 font-medium mb-0.5">
              Last contact · {daysAgoLabel(last.interaction_date)}
            </p>
            {last.summary
              ? <p className="text-sm text-gray-700 italic">"{last.summary}"</p>
              : <p className="text-sm text-gray-400">No notes recorded</p>
            }
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400">No previous contact on record</p>
          </div>
        )}

        {(contact.notes || action.notes) && (
          <div className="space-y-1">
            {contact.notes && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg">
                <span className="font-medium">Note: </span>{contact.notes}
              </p>
            )}
            {action.notes && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg">
                <span className="font-medium">Admin: </span>{action.notes}
              </p>
            )}
          </div>
        )}
      </div>

      {action.suggested_ask && (
        <div className="mx-4 mb-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-0.5">Ask</p>
          <p className="text-sm text-blue-900 font-medium">{action.suggested_ask}</p>
        </div>
      )}

      {action.suggested_message && (
        <div className="mx-4 mb-4">
          <button
            onClick={() => setShowMessage(!showMessage)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 transition-colors"
          >
            <span className="text-[10px]">{showMessage ? '▲' : '▼'}</span>
            {showMessage ? 'Hide message' : 'See suggested message'}
          </button>
          {showMessage && (
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{action.suggested_message}</p>
            </div>
          )}
        </div>
      )}

      {/* Log section */}
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">

        {mode === 'idle' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={logOutreach}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Logging…' : actionLabel}
            </button>
            <button
              onClick={() => setMode('responded')}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              They responded
            </button>
            <button
              onClick={async () => {
                setSaving(true)
                await supabase.from('actions').update({ status: 'Skipped' }).eq('id', action.id)
                setSaving(false)
                setMode('done')
              }}
              disabled={saving}
              className="text-gray-400 hover:text-gray-600 text-sm px-2 py-2 ml-auto transition-colors disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        )}

        {mode === 'responded' && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">What did they say?</p>

            <Select value={outcome} onValueChange={(v) => setOutcome(v ?? '')}>
              <SelectTrigger className="h-9 text-sm bg-white">
                <SelectValue placeholder="Select an outcome…" />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>

            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="text-sm h-16 resize-none bg-white"
            />

            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer text-gray-600">
                <input
                  type="checkbox"
                  checked={followUp}
                  onChange={e => setFollowUp(e.target.checked)}
                  className="rounded"
                />
                Schedule follow-up
              </label>
              {followUp && (
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
                />
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={logResponse} disabled={saving || !outcome} className="flex-1" size="sm">
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => { setMode('idle'); setOutcome(''); setNotes('') }}
                disabled={saving}
              >
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
