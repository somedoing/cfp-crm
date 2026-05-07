'use client'

import { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'

const VOLUNTEER_STAGES = ['New','Contacted','Interested','Asked','Assigned','Active','Reliable','Lead','Paused','Inactive','Not a fit']
const DONOR_STAGES = ['Prospect','Not asked','Asked','Pledged','Donated','Thanked','Recurring','Lapsed','Do not solicit']
const PRIORITIES = ['High', 'Medium', 'Low']

type ReviewContact = {
  id: string
  display_id: string | null
  first_name: string | null
  last_name: string | null
  full_name: string
  email: string | null
  phone: string | null
  town: string | null
  state: string | null
  zip: string | null
  county: string | null
  source: string | null
  original_source_form: string | null
  is_volunteer: boolean
  is_active_volunteer: boolean
  is_donor: boolean
  is_signature_collector: boolean
  is_press_contact: boolean
  is_media_contact: boolean
  is_candidate_partner: boolean
  is_supporter: boolean
  is_coalition_contact: boolean
  email_opt_in: boolean
  text_opt_in: boolean
  newsletter_subscriber: boolean
  in_discord: boolean
  discord_username: string | null
  volunteer_stage: string | null
  donor_stage: string | null
  signature_stage: string | null
  discord_stage: string | null
  media_stage: string | null
  priority: string | null
  date_added: string | null
  notes: string | null
  do_not_contact: boolean
  reviewed_at: string | null
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
    title: `Follow up with ${contact.full_name || contact.email || 'contact'}`,
    priority,
    action_type: 'Follow-up',
    action_area: 'General Supporter Follow-Up',
    assigned_to: 'admin',
    status: 'Needs Review',
    due_date: dueDate.toISOString().split('T')[0],
  }
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function ReviewWizard({
  contacts: initialContacts,
  initialPipelineIds,
}: {
  contacts: ReviewContact[]
  initialPipelineIds: string[]
}) {
  const supabase = createClient()
  const [contacts, setContacts] = useState(initialContacts)
  const [index, setIndex] = useState(0)
  const [pipelineIds, setPipelineIds] = useState(() => new Set(initialPipelineIds))
  const cardRef = useRef<{ saveAll: () => Promise<void> } | null>(null)

  // Queue: unreviewed (newest first) then reviewed (oldest reviewed first)
  const { unreviewed, reviewed, queue } = useMemo(() => {
    const unreviewed = contacts
      .filter(c => !c.reviewed_at && !c.do_not_contact)
      .sort((a, b) => (b.date_added ?? '').localeCompare(a.date_added ?? ''))
    const reviewed = contacts
      .filter(c => !!c.reviewed_at && !c.do_not_contact)
      .sort((a, b) => (a.reviewed_at ?? '').localeCompare(b.reviewed_at ?? ''))
    return { unreviewed, reviewed, queue: [...unreviewed, ...reviewed] }
  }, [contacts])

  const contact = queue[index] ?? null
  const isReviewedSection = index >= unreviewed.length
  const allUnreviewedDone = unreviewed.length === 0

  function updateContact(id: string, data: Partial<ReviewContact>) {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
  }

  async function markReviewed() {
    if (!contact) return
    if (cardRef.current) await cardRef.current.saveAll()
    const ts = new Date().toISOString()
    await supabase.from('contacts').update({ reviewed_at: ts }).eq('id', contact.id)
    updateContact(contact.id, { reviewed_at: ts })
    // Don't increment — queue recomputes, same index shows next unreviewed
  }

  async function addToPipeline() {
    if (!contact) return
    if (cardRef.current) await cardRef.current.saveAll()
    if (!pipelineIds.has(contact.id)) {
      setPipelineIds(prev => new Set([...prev, contact.id]))
      await supabase.from('actions').insert(actionParams(contact))
    }
    const ts = new Date().toISOString()
    await supabase.from('contacts').update({ reviewed_at: ts }).eq('id', contact.id)
    updateContact(contact.id, { reviewed_at: ts })
  }

  async function doNotContact() {
    if (!contact) return
    const ts = new Date().toISOString()
    await supabase.from('contacts').update({ do_not_contact: true, reviewed_at: ts }).eq('id', contact.id)
    updateContact(contact.id, { do_not_contact: true, reviewed_at: ts })
  }

  function skip() {
    setIndex(i => i + 1)
  }

  function goBack() {
    setIndex(i => Math.max(0, i - 1))
  }

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowRight' || e.key === 'n') skip()
      if (e.key === 'ArrowLeft' || e.key === 'p') goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const reviewedCount = contacts.filter(c => !!c.reviewed_at).length
  const totalNonDNC = contacts.filter(c => !c.do_not_contact).length
  const progress = totalNonDNC > 0 ? Math.round((reviewedCount / totalNonDNC) * 100) : 0

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <Link href="/contacts" className="text-gray-500 hover:text-gray-900 text-sm shrink-0">
          ← Contacts
        </Link>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-gray-600 text-sm font-medium">
            {unreviewed.length.toLocaleString()} left
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-green-600 text-sm font-medium">
            {reviewedCount.toLocaleString()} done
          </span>
          {isReviewedSection && contact && (
            <Badge className="bg-green-100 text-green-700 border-green-200">Reviewed</Badge>
          )}
        </div>

        <span className="text-gray-400 text-xs shrink-0 hidden sm:block">← → navigate</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {allUnreviewedDone && !contact && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-3">✓</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">All caught up!</h2>
          <p className="text-gray-500">
            {reviewedCount.toLocaleString()} contacts reviewed.
          </p>
          <Link href="/contacts" className="text-blue-600 hover:underline mt-4 text-sm">← Back to contacts</Link>
        </div>
      )}

      {allUnreviewedDone && contact && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">
          All unreviewed contacts done — scrolling through previously reviewed contacts below.
        </div>
      )}

      {contact && (
        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 items-start">
          {/* Contact edit card */}
          <div className="lg:col-span-3">
            <WizardCard
              key={contact.id}
              ref={cardRef}
              contact={contact}
              onUpdate={data => updateContact(contact.id, data)}
            />
          </div>

          {/* Action panel — sidebar on desktop, stacked below on mobile */}
          <div className="lg:col-span-2 lg:sticky lg:top-4">
            {/* Mobile: compact horizontal action bar */}
            <div className="lg:hidden bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">
                  {index + 1} / {queue.length.toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={goBack}
                    disabled={index === 0}
                    className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1 disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    onClick={skip}
                    className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1"
                  >
                    →
                  </button>
                  <Link
                    href={`/contacts/${contact.id}`}
                    target="_blank"
                    className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1"
                  >
                    ↗
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {pipelineIds.has(contact.id) ? (
                  <div className="col-span-2 flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-green-700 text-sm font-medium">✓ In pipeline</span>
                  </div>
                ) : (
                  <Button size="sm" className="col-span-2 bg-blue-600 hover:bg-blue-700" onClick={addToPipeline}>
                    + Add to pipeline
                  </Button>
                )}
                <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50 text-xs" onClick={markReviewed}>
                  Reviewed ✓ → Next
                </Button>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs" onClick={doNotContact}>
                  Do not contact
                </Button>
              </div>
            </div>

            {/* Desktop: full vertical panel */}
            <div className="hidden lg:block bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">
                {index + 1} / {queue.length.toLocaleString()}
                {isReviewedSection && <span className="ml-2 text-green-500">· Reviewed</span>}
              </p>

              {pipelineIds.has(contact.id) ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-green-700 text-sm font-medium">✓ In pipeline</span>
                </div>
              ) : (
                <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700" onClick={addToPipeline}>
                  + Add to pipeline
                </Button>
              )}

              <div className="border-t pt-3 mt-1 space-y-2">
                <Button variant="outline" className="w-full justify-start border-green-200 text-green-700 hover:bg-green-50" onClick={markReviewed}>
                  Reviewed ✓ → Next
                </Button>
                <Button variant="ghost" className="w-full justify-start text-gray-500" onClick={skip}>
                  Skip for now
                </Button>
                <Button variant="ghost" className="w-full justify-start text-red-400 hover:text-red-600 hover:bg-red-50" onClick={doNotContact}>
                  Do not contact
                </Button>
              </div>

              <div className="border-t pt-3 flex items-center justify-between">
                <button onClick={goBack} disabled={index === 0} className="text-gray-400 hover:text-gray-600 text-sm disabled:opacity-30">
                  ← Back
                </button>
                <Link href={`/contacts/${contact.id}`} target="_blank" className="text-gray-400 hover:text-gray-600 text-sm">
                  Full page ↗
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Editable contact card ─────────────────────────────────────────────────────

type WizardCardHandle = { saveAll: () => Promise<void> }

const WizardCard = forwardRef<WizardCardHandle, {
  contact: ReviewContact
  onUpdate: (data: Partial<ReviewContact>) => void
}>(function WizardCard({ contact, onUpdate }, ref) {
  const supabase = createClient()

  const [firstName, setFirstName] = useState(contact.first_name ?? '')
  const [lastName, setLastName] = useState(contact.last_name ?? '')
  const [email, setEmail] = useState(contact.email ?? '')
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [town, setTown] = useState(contact.town ?? '')
  const [stateVal, setStateVal] = useState(contact.state ?? '')
  const [zip, setZip] = useState(contact.zip ?? '')
  const [notes, setNotes] = useState(contact.notes ?? '')
  const [saving, setSaving] = useState(false)

  // Expose saveAll for parent to flush before advancing
  useImperativeHandle(ref, () => ({
    async saveAll() {
      await supabase.from('contacts').update({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        town: town.trim() || null,
        state: stateVal.trim() || null,
        zip: zip.trim() || null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', contact.id)
    }
  }))

  async function saveInfo() {
    const data = {
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      town: town.trim() || null,
      state: stateVal.trim() || null,
      zip: zip.trim() || null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('contacts').update(data).eq('id', contact.id)
    onUpdate(data)
  }

  async function saveNotes() {
    await supabase.from('contacts').update({
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', contact.id)
  }

  async function saveStage(field: string, value: string | null) {
    setSaving(true)
    await supabase.from('contacts').update({
      [field]: value || null,
      updated_at: new Date().toISOString(),
    }).eq('id', contact.id)
    onUpdate({ [field]: value || null } as any)
    setSaving(false)
  }

  async function toggleFlag(field: string, current: boolean) {
    const next = !current
    await supabase.from('contacts').update({
      [field]: next,
      updated_at: new Date().toISOString(),
    }).eq('id', contact.id)
    onUpdate({ [field]: next } as any)
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim()
    || contact.email || contact.display_id || '(no name)'

  const flags: { field: string; label: string; value: boolean; color?: string }[] = [
    { field: 'is_volunteer',          label: 'Volunteer',     value: contact.is_volunteer },
    { field: 'is_active_volunteer',   label: 'Active vol',    value: contact.is_active_volunteer, color: 'green' },
    { field: 'is_donor',              label: 'Donor',         value: contact.is_donor },
    { field: 'is_signature_collector',label: 'Sig collector', value: contact.is_signature_collector },
    { field: 'is_candidate_partner',  label: 'Political ally',value: contact.is_candidate_partner, color: 'purple' },
    { field: 'is_press_contact',      label: 'Press',         value: contact.is_press_contact, color: 'orange' },
    { field: 'is_media_contact',      label: 'Media',         value: contact.is_media_contact, color: 'orange' },
    { field: 'is_supporter',          label: 'Supporter',     value: contact.is_supporter },
    { field: 'newsletter_subscriber', label: 'Newsletter',    value: contact.newsletter_subscriber },
    { field: 'in_discord',            label: 'Discord',       value: contact.in_discord },
    { field: 'is_coalition_contact',  label: 'Coalition',     value: contact.is_coalition_contact },
    { field: 'email_opt_in',          label: 'Email opt-in',  value: contact.email_opt_in },
    { field: 'text_opt_in',           label: 'Text opt-in',   value: contact.text_opt_in },
  ]

  const colorMap: Record<string, string> = {
    green:  'bg-green-100 text-green-700 border-green-300',
    purple: 'bg-purple-100 text-purple-700 border-purple-300',
    orange: 'bg-orange-100 text-orange-700 border-orange-300',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
      {/* Name row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <p className="text-lg font-semibold text-gray-900">{displayName}</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="First name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              onBlur={saveInfo}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Last name"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              onBlur={saveInfo}
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="text-right text-xs text-gray-400 shrink-0 space-y-0.5">
          {contact.display_id && <div className="font-mono">{contact.display_id}</div>}
          {contact.date_added && <div>Added {contact.date_added}</div>}
          {contact.source && <div>{contact.source}</div>}
          {contact.original_source_form && <div className="max-w-32 truncate">{contact.original_source_form}</div>}
        </div>
      </div>

      {/* Contact info */}
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={saveInfo} className="h-8 text-sm" />
        <Input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} onBlur={saveInfo} className="h-8 text-sm" />
        <Input placeholder="Town" value={town} onChange={e => setTown(e.target.value)} onBlur={saveInfo} className="h-8 text-sm" />
        <div className="flex gap-1.5">
          <Input placeholder="ST" value={stateVal} onChange={e => setStateVal(e.target.value)} onBlur={saveInfo} className="h-8 text-sm w-14" />
          <Input placeholder="Zip" value={zip} onChange={e => setZip(e.target.value)} onBlur={saveInfo} className="h-8 text-sm flex-1" />
        </div>
      </div>

      {/* Flag toggles */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Roles / flags — click to toggle</p>
        <div className="flex flex-wrap gap-1.5">
          {flags.map(({ field, label, value, color }) => (
            <button
              key={field}
              onClick={() => toggleFlag(field, value)}
              className={`px-2 py-0.5 rounded border text-xs font-medium transition-all ${
                value
                  ? (color ? colorMap[color] : 'bg-gray-200 text-gray-800 border-gray-300')
                  : 'bg-white text-gray-300 border-gray-200 hover:border-gray-400 hover:text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
          {contact.do_not_contact && (
            <span className="px-2 py-0.5 rounded border text-xs font-medium bg-red-100 text-red-700 border-red-300">
              Do not contact
            </span>
          )}
        </div>
      </div>

      {/* Stages */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Volunteer stage</label>
          <Select
            value={contact.volunteer_stage ?? ''}
            onValueChange={v => v && saveStage('volunteer_stage', v)}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {VOLUNTEER_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Donor stage</label>
          <Select
            value={contact.donor_stage ?? ''}
            onValueChange={v => v && saveStage('donor_stage', v)}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {DONOR_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Priority</label>
          <Select
            value={contact.priority ?? ''}
            onValueChange={v => v && saveStage('priority', v)}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Notes</label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Notes about this person…"
          className="resize-none h-16 text-sm"
        />
      </div>

      {saving && <p className="text-xs text-gray-400">Saving…</p>}
    </div>
  )
})
