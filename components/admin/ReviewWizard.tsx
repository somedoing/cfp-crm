'use client'

import { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { ALL_TAGS } from '@/lib/tags'
import { retag } from '@/app/(admin)/contacts/review/actions'

const VOLUNTEER_STAGES = ['New','Contacted','Interested','Asked','Assigned','Active','Reliable','Lead','Paused','Inactive','Not a fit']
const DONOR_STAGES = ['Prospect','Not asked','Asked','Pledged','Donated','Thanked','Recurring','Lapsed','Do not solicit']
const PRIORITIES = ['High', 'Medium', 'Low']

type TaskTemplate = {
  id: string
  title: string
  description: string | null
  suggested_ask: string | null
  suggested_message: string | null
  action_type: string
  action_area: string | null
  priority: string
}

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
  created_at: string | null
  notes: string | null
  do_not_contact: boolean
  reviewed_at: string | null
  tags: string[]
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

type User = { id: string; full_name: string }

export default function ReviewWizard({
  contacts: initialContacts,
  initialPipelineIds,
  users = [],
  templates = [],
}: {
  contacts: ReviewContact[]
  initialPipelineIds: string[]
  users?: User[]
  templates?: TaskTemplate[]
}) {
  const supabase = createClient()
  const [contacts, setContacts] = useState(initialContacts)
  const [index, setIndex] = useState(0)
  const [pipelineIds, setPipelineIds] = useState(() => new Set(initialPipelineIds))
  const [assignUserId, setAssignUserId] = useState<string>('')
  const [templateId, setTemplateId] = useState<string>('')
  const [pipelineError, setPipelineError] = useState<string>('')
  const [retagging, setRetagging] = useState(false)
  const [retagResult, setRetagResult] = useState<string>('')
  const cardRef = useRef<{ saveAll: () => Promise<void> } | null>(null)

  async function runRetag() {
    setRetagging(true)
    setRetagResult('')
    const result = await retag()
    if ('error' in result) {
      setRetagResult(`Error: ${result.error}`)
    } else {
      setRetagResult(`Done — updated ${result.updated} of ${result.total} contacts`)
      window.location.reload()
    }
    setRetagging(false)
  }

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
    setPipelineError('')
    if (cardRef.current) await cardRef.current.saveAll()
    if (!pipelineIds.has(contact.id)) {
      const base = actionParams(contact)
      const senderOverrides = assignUserId ? {
        assigned_user_id: assignUserId,
        assigned_to: 'sender',
        status: 'To Contact',
      } : {}
      const tpl = templates.find(t => t.id === templateId)
      const templateOverrides = tpl ? {
        title: `${contact.first_name ?? contact.full_name.split(' ')[0] ?? 'Contact'} — ${tpl.title}`,
        action_type: tpl.action_type,
        priority: tpl.priority,
        action_area: tpl.action_area ?? base.action_area,
        suggested_ask: tpl.suggested_ask ?? null,
        suggested_message: tpl.suggested_message ?? null,
      } : {}
      const { error } = await supabase.from('actions').insert({ ...base, ...senderOverrides, ...templateOverrides })
      if (error) { setPipelineError(error.message); return }
      setPipelineIds(prev => new Set([...prev, contact.id]))
    }
    const ts = new Date().toISOString()
    await supabase.from('contacts').update({ reviewed_at: ts }).eq('id', contact.id)
    updateContact(contact.id, { reviewed_at: ts })
  }

  async function addToBullseye(tier: 'Supporter' | 'Active' | 'Core') {
    if (!contact) return
    if (cardRef.current) await cardRef.current.saveAll()
    const priorityMap: Record<string, string> = { Core: 'High', Active: 'Medium', Supporter: 'Low' }
    await supabase.from('actions').insert({
      contact_id: contact.id,
      title: `${contact.first_name ?? contact.full_name.split(' ')[0] ?? contact.email} — ${tier}`,
      action_type: 'Check in',
      action_area: 'General Supporter Follow-Up',
      assigned_to: 'admin',
      status: tier,
      priority: priorityMap[tier],
      due_date: new Date().toISOString().split('T')[0],
    })
    setPipelineIds(prev => new Set([...prev, contact.id]))
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

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-gray-400 text-xs hidden sm:block">← → navigate</span>
          <button
            onClick={runRetag}
            disabled={retagging}
            className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
            title="Strip old tags and re-apply correct tags from contact flags"
          >
            {retagging ? 'Fixing tags…' : 'Fix tags'}
          </button>
        </div>
      </div>
      {retagResult && (
        <p className="text-xs text-gray-500 text-right">{retagResult}</p>
      )}

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
            <div className="lg:hidden bg-white rounded-xl border border-gray-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {index + 1} / {queue.length.toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={goBack} disabled={index === 0} className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1 disabled:opacity-30">←</button>
                  <button onClick={skip} className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1">→</button>
                  <Link href={`/contacts/${contact.id}`} target="_blank" className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1">↗</Link>
                </div>
              </div>
              {users.length > 0 && (
                <select
                  value={assignUserId}
                  onChange={e => setAssignUserId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Assign to… (optional)</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              )}
              {templates.length > 0 && (
                <select
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Task template… (optional)</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              )}
              {pipelineError && <p className="text-red-600 text-xs">{pipelineError}</p>}
              <div className="grid grid-cols-2 gap-2">
                {pipelineIds.has(contact.id) ? (
                  <div className="col-span-2 flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-green-700 text-sm font-medium">✓ In pipeline</span>
                  </div>
                ) : (
                  <Button size="sm" className="col-span-2 bg-blue-600 hover:bg-blue-700" onClick={addToPipeline}>
                    + Add to pipeline{assignUserId ? ` → ${users.find(u => u.id === assignUserId)?.full_name}` : ''}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50 text-xs" onClick={markReviewed}>
                  Reviewed ✓ → Next
                </Button>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs" onClick={doNotContact}>
                  Do not contact
                </Button>
              </div>
              <div className="border-t pt-2">
                <p className="text-xs text-gray-400 mb-1.5">Engagement tier</p>
                <div className="flex gap-1.5">
                  {(['Supporter', 'Active', 'Core'] as const).map(tier => (
                    <button key={tier} onClick={() => addToBullseye(tier)}
                      className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                        tier === 'Core' ? 'border-amber-200 text-amber-700 hover:bg-amber-50' :
                        tier === 'Active' ? 'border-indigo-200 text-indigo-700 hover:bg-indigo-50' :
                        'border-teal-200 text-teal-700 hover:bg-teal-50'
                      }`}>
                      {tier}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop: full vertical panel */}
            <div className="hidden lg:block bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">
                {index + 1} / {queue.length.toLocaleString()}
                {isReviewedSection && <span className="ml-2 text-green-500">· Reviewed</span>}
              </p>

              {users.length > 0 && (
                <select
                  value={assignUserId}
                  onChange={e => setAssignUserId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Assign to… (optional)</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              )}

              {templates.length > 0 && (
                <select
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Task template… (optional)</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              )}
              {templateId && (() => {
                const tpl = templates.find(t => t.id === templateId)
                return tpl?.description ? (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5">{tpl.description}</p>
                ) : null
              })()}

              {pipelineError && <p className="text-red-600 text-xs">{pipelineError}</p>}
              {pipelineIds.has(contact.id) ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-green-700 text-sm font-medium">✓ In pipeline</span>
                </div>
              ) : (
                <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700" onClick={addToPipeline}>
                  + Add to pipeline{assignUserId ? ` → ${users.find(u => u.id === assignUserId)?.full_name}` : ''}
                </Button>
              )}

              <div className="border-t pt-2 space-y-1.5">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Engagement tier</p>
                <div className="flex gap-1.5">
                  {(['Supporter', 'Active', 'Core'] as const).map(tier => (
                    <button key={tier} onClick={() => addToBullseye(tier)}
                      className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                        tier === 'Core' ? 'border-amber-200 text-amber-700 hover:bg-amber-50' :
                        tier === 'Active' ? 'border-indigo-200 text-indigo-700 hover:bg-indigo-50' :
                        'border-teal-200 text-teal-700 hover:bg-teal-50'
                      }`}>
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

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
  const [tags, setTags] = useState<string[]>(contact.tags ?? [])
  const [donations, setDonations] = useState<{ id: string; interaction_date: string | null; summary: string | null }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!contact.is_donor) { setDonations([]); return }
    supabase
      .from('interactions')
      .select('id, interaction_date, summary')
      .eq('contact_id', contact.id)
      .eq('interaction_type', 'Donation')
      .order('interaction_date', { ascending: false })
      .then(({ data }) => setDonations(data ?? []))
  }, [contact.id])

  async function addTag(tag: string) {
    const next = [...new Set([...tags, tag])]
    setTags(next)
    await supabase.from('contacts').update({ tags: next, updated_at: new Date().toISOString() }).eq('id', contact.id)
  }

  async function removeTag(tag: string) {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    await supabase.from('contacts').update({ tags: next, updated_at: new Date().toISOString() }).eq('id', contact.id)
  }

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

  const dateAdded = contact.date_added
    ? new Date(contact.date_added).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
      {/* Name row */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-semibold text-gray-900">{displayName}</p>
          {contact.display_id && <span className="text-xs text-gray-400 font-mono shrink-0">{contact.display_id}</span>}
        </div>

        {/* What they did — the main thing you need to know */}
        <div className="rounded-lg border border-gray-200 px-3 py-2.5 space-y-1.5">
          {contact.is_donor && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-sm font-semibold text-gray-900">Donated</span>
              </div>
              <span className="text-xs text-gray-400">{dateAdded ?? 'date unknown'}</span>
            </div>
          )}
          {contact.is_volunteer && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span className="text-sm font-semibold text-gray-900">Signed up to volunteer</span>
              </div>
              <span className="text-xs text-gray-400">{dateAdded ?? 'date unknown'}</span>
            </div>
          )}
          {contact.is_signature_collector && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                <span className="text-sm font-semibold text-gray-900">Signed up to collect signatures</span>
              </div>
              <span className="text-xs text-gray-400">{dateAdded ?? 'date unknown'}</span>
            </div>
          )}
          {contact.newsletter_subscriber && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                <span className="text-sm text-gray-700">Newsletter subscriber</span>
              </div>
              <span className="text-xs text-gray-400">{dateAdded ?? 'date unknown'}</span>
            </div>
          )}
          {!contact.is_donor && !contact.is_volunteer && !contact.is_signature_collector && !contact.newsletter_subscriber && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-sm text-amber-700">No specific action on record</span>
            </div>
          )}
          {contact.original_source_form && contact.original_source_form !== 'Squarespace Contacts Export' && (
            <p className="text-xs text-gray-400 pt-0.5">via {contact.original_source_form}</p>
          )}
        </div>

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

      {contact.do_not_contact && (
        <span className="px-2 py-0.5 rounded border text-xs font-medium bg-red-100 text-red-700 border-red-300">
          Do not contact
        </span>
      )}

      {/* Donation history */}
      {contact.is_donor && (
        <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
          <p className="text-xs font-medium text-green-700 mb-1">Donation history</p>
          {donations.length === 0
            ? <p className="text-xs text-green-600">Marked as donor — no detailed records</p>
            : donations.map(d => (
                <p key={d.id} className="text-xs text-green-800">
                  {d.interaction_date ?? '—'} · {d.summary}
                </p>
              ))
          }
        </div>
      )}

      {/* Stages — only show when the relevant flag is active */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {contact.is_volunteer && (
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
        )}
        {contact.is_donor && (
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
        )}
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

      {/* History / source tags */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">History — where they came from, what they've done</p>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {tags.length === 0 && (
            <span className="text-xs text-amber-600">No history tags yet</span>
          )}
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => removeTag(tag)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 border border-gray-300 text-xs font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              {tag} <span className="opacity-40 ml-0.5">×</span>
            </button>
          ))}
        </div>
        <select
          value=""
          onChange={e => e.target.value && addTag(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-500 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">+ Add tag…</option>
          {ALL_TAGS.filter(t => !tags.includes(t)).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {saving && <p className="text-xs text-gray-400">Saving…</p>}
    </div>
  )
})
