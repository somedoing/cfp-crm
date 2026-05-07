'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
const INTERACTION_TYPES = ['Email','Call','Text','Discord','In-person','Meeting','Event','Form submission','Donation','Internal note']

const CLOSED_STATUSES = ['Done','Committed','Declined','Unresponsive','Dropped','Skipped']

const STATUS_COLORS: Record<string, string> = {
  'Needs Review':     'bg-gray-100 text-gray-600',
  'To Contact':       'bg-blue-100 text-blue-700',
  'Contacted':        'bg-yellow-100 text-yellow-700',
  'Follow-up':        'bg-orange-100 text-orange-700',
  'Positive Response':'bg-green-100 text-green-700',
  'Done':             'bg-gray-100 text-gray-500',
  'Committed':        'bg-green-200 text-green-800',
  'Declined':         'bg-red-100 text-red-600',
  'Unresponsive':     'bg-gray-200 text-gray-500',
  'Dropped':          'bg-gray-200 text-gray-400',
  'Skipped':          'bg-gray-200 text-gray-400',
}

type Contact = {
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
  newsletter_subscriber: boolean
  email_opt_in: boolean
  text_opt_in: boolean
  in_discord: boolean
  discord_username: string | null
  is_supporter: boolean
  is_volunteer: boolean
  is_active_volunteer: boolean
  is_signature_collector: boolean
  is_donor: boolean
  is_media_contact: boolean
  is_org_contact: boolean
  is_candidate_partner: boolean
  is_coalition_contact: boolean
  is_press_contact: boolean
  do_not_contact: boolean
  volunteer_stage: string | null
  donor_stage: string | null
  signature_stage: string | null
  discord_stage: string | null
  media_stage: string | null
  partner_stage: string | null
  support_level: number | null
  priority: string | null
  last_contact_date: string | null
  last_contact_summary: string | null
  notes: string | null
  date_added: string | null
}

type Action = {
  id: string
  title: string
  status: string
  priority: string
  action_type: string
  action_area: string
  due_date: string | null
  sent_at: string | null
  completed_date: string | null
  notes: string | null
  created_at: string
}

type Interaction = {
  id: string
  interaction_date: string | null
  interaction_type: string | null
  direction: string | null
  summary: string | null
  result: string | null
  notes: string | null
  created_at: string
}

export default function ContactDetail({
  contact: initial,
  actions,
  interactions: initialInteractions,
}: {
  contact: Contact
  actions: Action[]
  interactions: Interaction[]
}) {
  const supabase = createClient()
  const router = useRouter()

  // Basic info (editable)
  const [firstName, setFirstName] = useState(initial.first_name ?? '')
  const [lastName, setLastName] = useState(initial.last_name ?? '')
  const [email, setEmail] = useState(initial.email ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [town, setTown] = useState(initial.town ?? '')
  const [stateVal, setStateVal] = useState(initial.state ?? '')
  const [zip, setZip] = useState(initial.zip ?? '')
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoSaved, setInfoSaved] = useState(false)

  const [volunteerStage, setVolunteerStageState] = useState(initial.volunteer_stage ?? '')
  const [donorStage, setDonorStageState] = useState(initial.donor_stage ?? '')
  const [priority, setPriorityState] = useState(initial.priority ?? '')
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [notesSaved, setNotesSaved] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [interactions, setInteractions] = useState<Interaction[]>(initialInteractions)

  // Interaction form
  const today = new Date().toISOString().split('T')[0]
  const [intType, setIntType] = useState('Email')
  const [intDir, setIntDir] = useState('Outbound')
  const [intDate, setIntDate] = useState(today)
  const [intSummary, setIntSummary] = useState('')
  const [intNotes, setIntNotes] = useState('')
  const [addingInt, setAddingInt] = useState(false)

  async function saveField(field: string, value: string | null) {
    await supabase.from('contacts').update({
      [field]: value || null,
      updated_at: new Date().toISOString(),
    }).eq('id', initial.id)
  }

  async function saveContactInfo() {
    setSavingInfo(true)
    await supabase.from('contacts').update({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      town: town.trim() || null,
      state: stateVal.trim() || null,
      zip: zip.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', initial.id)
    setSavingInfo(false)
    setInfoSaved(true)
    setTimeout(() => setInfoSaved(false), 2000)
  }

  async function handleVolunteerStage(val: string | null) {
    if (!val) return
    setVolunteerStageState(val)
    await saveField('volunteer_stage', val)
  }

  async function handleDonorStage(val: string | null) {
    if (!val) return
    setDonorStageState(val)
    await saveField('donor_stage', val)
  }

  async function handlePriority(val: string | null) {
    if (!val) return
    setPriorityState(val)
    await saveField('priority', val)
  }

  async function saveNotes() {
    setSavingNotes(true)
    await saveField('notes', notes)
    setSavingNotes(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  async function addInteraction() {
    if (!intSummary.trim()) return
    setAddingInt(true)
    const { data } = await supabase.from('interactions').insert({
      contact_id: initial.id,
      interaction_type: intType,
      direction: intDir,
      interaction_date: intDate,
      summary: intSummary.trim(),
      notes: intNotes.trim() || null,
    }).select('id, interaction_date, interaction_type, direction, summary, result, notes, created_at').single()
    if (data) {
      setInteractions(prev => [data as Interaction, ...prev])
    }
    setIntSummary('')
    setIntNotes('')
    setIntDate(today)
    setAddingInt(false)
  }

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('interactions').delete().eq('contact_id', initial.id)
    await supabase.from('actions').delete().eq('contact_id', initial.id)
    await supabase.from('contacts').delete().eq('id', initial.id)
    router.push('/contacts')
  }

  const openActions = actions.filter(a => !CLOSED_STATUSES.includes(a.status))
  const closedActions = actions.filter(a => CLOSED_STATUSES.includes(a.status))
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim()
    || initial.email || initial.display_id || '(no name)'

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back nav */}
      <Link href="/contacts" className="text-gray-500 hover:text-gray-900 text-sm">
        ← Contacts
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-gray-900">{displayName}</h1>
            {initial.display_id && (
              <span className="text-gray-400 text-sm font-mono">{initial.display_id}</span>
            )}
            {initial.do_not_contact && <Badge variant="destructive">Do not contact</Badge>}
          </div>
          <div className="text-right shrink-0 space-y-0.5">
            {initial.date_added && (
              <div className="text-gray-400 text-sm">Added {initial.date_added}</div>
            )}
            {initial.source && (
              <div className="text-gray-400 text-sm">{initial.source}</div>
            )}
            {initial.original_source_form && (
              <div className="text-gray-400 text-xs">{initial.original_source_form}</div>
            )}
          </div>
        </div>

        {/* Editable basic info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} className="h-8 text-sm" />
          <Input placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} className="h-8 text-sm" />
          <Input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-8 text-sm" />
          <Input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} className="h-8 text-sm" />
          <Input placeholder="Town" value={town} onChange={e => setTown(e.target.value)} className="h-8 text-sm" />
          <div className="flex gap-2">
            <Input placeholder="State" value={stateVal} onChange={e => setStateVal(e.target.value)} className="h-8 text-sm w-20" />
            <Input placeholder="Zip" value={zip} onChange={e => setZip(e.target.value)} className="h-8 text-sm flex-1" />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={saveContactInfo} disabled={savingInfo}>
            {savingInfo ? 'Saving…' : 'Save info'}
          </Button>
          {infoSaved && <span className="text-green-600 text-sm">Saved</span>}
        </div>

        {/* Flags */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {initial.is_volunteer && <Badge variant="secondary">Volunteer</Badge>}
          {initial.is_active_volunteer && <Badge className="bg-green-100 text-green-700">Active volunteer</Badge>}
          {initial.is_donor && <Badge variant="secondary">Donor</Badge>}
          {initial.is_signature_collector && <Badge variant="secondary">Sig collector</Badge>}
          {initial.is_supporter && <Badge variant="secondary">Supporter</Badge>}
          {initial.is_candidate_partner && <Badge className="bg-purple-100 text-purple-700">Political ally</Badge>}
          {initial.is_press_contact && <Badge className="bg-orange-100 text-orange-700">Press</Badge>}
          {initial.is_media_contact && !initial.is_press_contact && <Badge className="bg-orange-100 text-orange-700">Media</Badge>}
          {initial.newsletter_subscriber && <Badge variant="secondary">Newsletter</Badge>}
          {initial.in_discord && (
            <Badge variant="secondary">Discord{initial.discord_username ? `: ${initial.discord_username}` : ''}</Badge>
          )}
          {initial.is_coalition_contact && <Badge variant="secondary">Coalition</Badge>}
          {initial.email_opt_in && <Badge variant="secondary">Email opt-in</Badge>}
          {initial.text_opt_in && <Badge variant="secondary">Text opt-in</Badge>}
        </div>

        {/* Editable stages row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t">
          <div className="space-y-1">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Volunteer stage</label>
            <Select value={volunteerStage} onValueChange={handleVolunteerStage}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {VOLUNTEER_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Donor stage</label>
            <Select value={donorStage} onValueChange={handleDonorStage}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {DONOR_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Priority</label>
            <Select value={priority} onValueChange={handlePriority}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-4 space-y-2">
          <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Notes</label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes about this contact…"
            className="resize-none h-20 text-sm"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={saveNotes} disabled={savingNotes}>
              {savingNotes ? 'Saving…' : 'Save notes'}
            </Button>
            {notesSaved && <span className="text-green-600 text-sm">Saved</span>}
          </div>
        </div>
      </div>

      {/* Open actions */}
      {openActions.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-gray-800">
            Open actions <span className="text-gray-400 font-normal">({openActions.length})</span>
          </h2>
          <div className="space-y-2">
            {openActions.map(action => (
              <div key={action.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[action.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {action.status}
                  </span>
                  <span className="text-gray-400 text-xs">{action.action_type}</span>
                  {action.due_date && (
                    <span className="text-gray-400 text-xs">Due {action.due_date}</span>
                  )}
                  <Link href={`/actions/${action.id}`} className="text-gray-400 hover:text-blue-600 text-xs ml-auto">Edit →</Link>
                </div>
                <p className="text-gray-800 text-sm">{action.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log interaction */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Log interaction</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Type</label>
            <Select value={intType} onValueChange={v => v && setIntType(v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Direction</label>
            <Select value={intDir} onValueChange={v => v && setIntDir(v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Outbound">Outbound</SelectItem>
                <SelectItem value="Inbound">Inbound</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Date</label>
            <input
              type="date"
              value={intDate}
              onChange={e => setIntDate(e.target.value)}
              className="h-8 w-full border border-gray-200 rounded-md px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Summary *</label>
          <input
            type="text"
            value={intSummary}
            onChange={e => setIntSummary(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !addingInt && intSummary.trim() && addInteraction()}
            placeholder="What happened? e.g. Left voicemail, sent volunteer ask email"
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Additional notes (optional)</label>
          <Textarea
            value={intNotes}
            onChange={e => setIntNotes(e.target.value)}
            placeholder="Any extra context…"
            className="resize-none h-16 text-sm"
          />
        </div>
        <Button onClick={addInteraction} disabled={addingInt || !intSummary.trim()} size="sm">
          {addingInt ? 'Logging…' : 'Log interaction'}
        </Button>
      </div>

      {/* Interaction history */}
      <div className="space-y-2">
        <h2 className="font-semibold text-gray-800">
          History <span className="text-gray-400 font-normal">({interactions.length})</span>
        </h2>
        {interactions.length === 0 && (
          <p className="text-gray-400 text-sm py-4 text-center">No interactions logged yet.</p>
        )}
        <div className="space-y-2">
          {interactions.map(int => (
            <div key={int.id} className="bg-white rounded-lg border border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-700">{int.interaction_type}</span>
                {int.direction && (
                  <span className="text-gray-400">· {int.direction}</span>
                )}
                <span className="text-gray-400 ml-auto">
                  {int.interaction_date ?? int.created_at.split('T')[0]}
                </span>
              </div>
              {int.summary && (
                <p className="text-gray-800 text-sm mt-1">{int.summary}</p>
              )}
              {int.result && (
                <p className="text-gray-500 text-sm mt-0.5">Result: {int.result}</p>
              )}
              {int.notes && (
                <p className="text-gray-400 text-sm mt-0.5 italic">{int.notes}</p>
              )}
            </div>
          ))}
        </div>

        {/* Closed actions as history */}
        {closedActions.length > 0 && (
          <details className="mt-2">
            <summary className="text-gray-400 text-sm cursor-pointer hover:text-gray-600">
              {closedActions.length} closed action{closedActions.length !== 1 ? 's' : ''}
            </summary>
            <div className="space-y-2 mt-2">
              {closedActions.map(action => (
                <div key={action.id} className="bg-gray-50 rounded-lg border border-gray-100 px-4 py-3 flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[action.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {action.status}
                  </span>
                  <span className="text-gray-600 flex-1 text-sm">{action.title}</span>
                  {action.completed_date && (
                    <span className="text-gray-400 text-sm">{action.completed_date}</span>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Danger zone */}
      <div className="border border-gray-200 rounded-xl p-4">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Danger zone</p>
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href={`/contacts/${initial.id}/merge`}
            className="text-gray-500 hover:text-gray-800 text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors"
          >
            Merge with duplicate…
          </Link>

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-red-400 hover:text-red-600 text-sm border border-red-100 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors"
            >
              Delete contact
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-red-700 text-sm">
                Delete {displayName} and all their actions/interactions?
              </span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 text-white rounded px-3 py-1 text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
