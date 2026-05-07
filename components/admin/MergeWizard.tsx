'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { mergeContacts } from '@/app/(admin)/contacts/merge/actions'

const FIELDS = 'id, display_id, first_name, last_name, full_name, email, alternative_emails, phone, town, state, zip, county, source, original_source_form, notes, date_added, is_volunteer, is_active_volunteer, is_donor, is_signature_collector, is_supporter, is_media_contact, is_press_contact, is_coalition_contact, is_candidate_partner, newsletter_subscriber, email_opt_in, text_opt_in, in_discord, discord_username, volunteer_stage, donor_stage, signature_stage, priority, tags, do_not_contact'

type Contact = {
  id: string
  display_id: string | null
  first_name: string | null
  last_name: string | null
  full_name: string
  email: string | null
  alternative_emails: string[] | null
  phone: string | null
  town: string | null
  state: string | null
  zip: string | null
  county: string | null
  source: string | null
  original_source_form: string | null
  notes: string | null
  date_added: string | null
  is_volunteer: boolean
  is_active_volunteer: boolean
  is_donor: boolean
  is_signature_collector: boolean
  is_supporter: boolean
  is_media_contact: boolean
  is_press_contact: boolean
  is_coalition_contact: boolean
  is_candidate_partner: boolean
  newsletter_subscriber: boolean
  email_opt_in: boolean
  text_opt_in: boolean
  in_discord: boolean
  discord_username: string | null
  volunteer_stage: string | null
  donor_stage: string | null
  signature_stage: string | null
  priority: string | null
  tags: string[] | null
  do_not_contact: boolean
}

type DupePair = {
  key: string
  reason: 'email' | 'name'
  a: Contact
  b: Contact
}

const CHOICE_FIELDS: { key: keyof Contact; label: string }[] = [
  { key: 'first_name',        label: 'First name' },
  { key: 'last_name',         label: 'Last name' },
  { key: 'phone',             label: 'Phone' },
  { key: 'town',              label: 'Town' },
  { key: 'state',             label: 'State' },
  { key: 'zip',               label: 'ZIP' },
  { key: 'source',            label: 'Source' },
  { key: 'volunteer_stage',   label: 'Volunteer stage' },
  { key: 'donor_stage',       label: 'Donor stage' },
  { key: 'priority',          label: 'Priority' },
  { key: 'discord_username',  label: 'Discord username' },
]

const BOOL_FLAGS: (keyof Contact)[] = [
  'is_volunteer', 'is_active_volunteer', 'is_donor', 'is_signature_collector',
  'is_supporter', 'is_media_contact', 'is_press_contact', 'is_coalition_contact',
  'is_candidate_partner', 'newsletter_subscriber', 'email_opt_in', 'text_opt_in',
  'in_discord', 'do_not_contact',
]

async function fetchAllContacts(): Promise<Contact[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('contacts')
    .select(FIELDS)
    .order('id', { ascending: true })
    .range(0, 9999)
  return (data as Contact[]) ?? []
}

function computePairs(contacts: Contact[]): DupePair[] {
  const emailGroups = new Map<string, Contact[]>()
  for (const c of contacts) {
    if (!c.email?.trim()) continue
    const key = c.email.toLowerCase().trim()
    if (!emailGroups.has(key)) emailGroups.set(key, [])
    emailGroups.get(key)!.push(c)
  }

  const nameGroups = new Map<string, Contact[]>()
  for (const c of contacts) {
    const first = (c.first_name ?? '').toLowerCase().trim()
    const last = (c.last_name ?? '').toLowerCase().trim()
    if (!first || !last) continue
    const key = `${first}|${last}`
    if (!nameGroups.has(key)) nameGroups.set(key, [])
    nameGroups.get(key)!.push(c)
  }

  const seenPairs = new Set<string>()
  const pairs: DupePair[] = []

  function addPairs(groups: Map<string, Contact[]>, reason: 'email' | 'name') {
    for (const group of groups.values()) {
      if (group.length < 2) continue
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const pairKey = [group[i].id, group[j].id].sort().join('|')
          if (seenPairs.has(pairKey)) continue
          seenPairs.add(pairKey)
          pairs.push({ key: pairKey, reason, a: group[i], b: group[j] })
        }
      }
    }
  }

  addPairs(emailGroups, 'email')
  addPairs(nameGroups, 'name')
  return pairs
}

function defaultChoices(a: Contact, b: Contact): Record<string, 'a' | 'b'> {
  const choices: Record<string, 'a' | 'b'> = {}
  for (const { key } of CHOICE_FIELDS) {
    choices[key as string] = (!a[key] && b[key]) ? 'b' : 'a'
  }
  return choices
}

function PairRow({ pair, onDismiss, onMerged }: { pair: DupePair; onDismiss: (key: string) => void; onMerged: (key: string) => void }) {
  const [open, setOpen] = useState(false)
  const [primaryId, setPrimaryId] = useState(pair.a.id)
  const [fieldChoices, setFieldChoices] = useState<Record<string, 'a' | 'b'>>(() => defaultChoices(pair.a, pair.b))
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState('')

  const { a, b } = pair
  const isPrimaryA = primaryId === a.id
  const primary = isPrimaryA ? a : b
  const secondary = isPrimaryA ? b : a

  function flipPrimary(newId: string) {
    if (newId === primaryId) return
    setPrimaryId(newId)
    setFieldChoices(prev => {
      const next: Record<string, 'a' | 'b'> = {}
      for (const k of Object.keys(prev)) next[k] = prev[k] === 'a' ? 'b' : 'a'
      return next
    })
  }

  const conflicts = CHOICE_FIELDS.filter(({ key }) => {
    const aVal = a[key]; const bVal = b[key]
    return aVal && bVal && aVal !== bVal
  })

  const hasDifferentEmails = a.email && b.email && a.email !== b.email

  async function handleMerge() {
    setMerging(true)
    setError('')

    const mergedData: Record<string, unknown> = {}

    for (const { key } of CHOICE_FIELDS) {
      mergedData[key as string] = (fieldChoices[key as string] === 'a' ? a[key] : b[key]) || null
    }
    for (const flag of BOOL_FLAGS) {
      mergedData[flag as string] = !!(a[flag] || b[flag])
    }

    mergedData.tags = [...new Set([...(a.tags ?? []), ...(b.tags ?? [])])]

    if (a.date_added && b.date_added) {
      mergedData.date_added = a.date_added < b.date_added ? a.date_added : b.date_added
    } else {
      mergedData.date_added = a.date_added || b.date_added
    }

    if (primary.notes && secondary.notes && primary.notes !== secondary.notes) {
      mergedData.notes = `${primary.notes}\n\n--- merged from duplicate ---\n${secondary.notes}`
    } else {
      mergedData.notes = primary.notes || secondary.notes || null
    }

    const altEmails = [...(primary.alternative_emails ?? []), ...(secondary.alternative_emails ?? [])]
    if (secondary.email && secondary.email !== primary.email) altEmails.push(secondary.email)
    mergedData.alternative_emails = [...new Set(altEmails.filter(Boolean))]
    mergedData.email = primary.email

    try {
      const result = await mergeContacts({ primaryId: primary.id, secondaryId: secondary.id, mergedData })
      if (result.error) {
        setError(result.error)
        setMerging(false)
        return
      }
      onMerged(pair.key)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setMerging(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${pair.reason === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
          {pair.reason}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-900">{a.full_name || a.email || '—'}</span>
          <span className="text-gray-400 mx-2 text-sm">vs</span>
          <span className="text-sm text-gray-600">{b.full_name || b.email || '—'}</span>
          {hasDifferentEmails && <span className="ml-2 text-xs text-orange-500">different emails</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onDismiss(pair.key)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100">
            Not duplicates
          </button>
          <button onClick={() => setOpen(o => !o)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 font-medium">
            {open ? 'Close ▲' : 'Review ▼'}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[a, b].map(contact => {
              const isPrimary = contact.id === primaryId
              return (
                <div key={contact.id} className={`rounded-lg border-2 p-3 bg-white transition-all ${isPrimary ? 'border-blue-400' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPrimary ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {isPrimary ? '★ Primary (keep)' : 'Secondary (delete)'}
                    </span>
                    {!isPrimary && (
                      <button onClick={() => flipPrimary(contact.id)} className="text-xs text-blue-600 hover:underline">Make primary</button>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{contact.full_name || '(no name)'}</p>
                  <div className="mt-2 space-y-0.5">
                    {[
                      { label: 'Email',       value: contact.email },
                      { label: 'Phone',       value: contact.phone },
                      { label: 'Town',        value: contact.town },
                      { label: 'State',       value: contact.state },
                      { label: 'ZIP',         value: contact.zip },
                      { label: 'Source',      value: contact.source },
                      { label: 'Added',       value: contact.date_added },
                      { label: 'Vol stage',   value: contact.volunteer_stage },
                      { label: 'Donor stage', value: contact.donor_stage },
                      { label: 'Discord',     value: contact.discord_username },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex gap-1.5 text-xs">
                        <span className="text-gray-400 w-20 shrink-0">{label}</span>
                        <span className={value ? 'text-gray-700' : 'text-gray-300'}>{value || '—'}</span>
                      </div>
                    ))}
                    <div className="flex gap-1 text-xs pt-0.5 flex-wrap">
                      {contact.is_volunteer && <span className="bg-gray-100 text-gray-600 rounded px-1">Vol</span>}
                      {contact.is_donor && <span className="bg-gray-100 text-gray-600 rounded px-1">Donor</span>}
                      {contact.is_signature_collector && <span className="bg-gray-100 text-gray-600 rounded px-1">Sig</span>}
                      {contact.is_supporter && <span className="bg-gray-100 text-gray-600 rounded px-1">Supporter</span>}
                      {contact.newsletter_subscriber && <span className="bg-gray-100 text-gray-600 rounded px-1">Newsletter</span>}
                      {contact.do_not_contact && <span className="bg-red-100 text-red-600 rounded px-1">DNC</span>}
                    </div>
                    {contact.tags && contact.tags.length > 0 && (
                      <p className="text-xs text-blue-600 truncate">{contact.tags.join(', ')}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {conflicts.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Conflicting fields — click to pick</p>
              <div className="space-y-1.5">
                {conflicts.map(({ key, label }) => {
                  const aVal = String(a[key] ?? '')
                  const bVal = String(b[key] ?? '')
                  const choice = fieldChoices[key as string]
                  return (
                    <div key={key as string} className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs w-24 shrink-0">{label}</span>
                      <button onClick={() => setFieldChoices(p => ({ ...p, [key as string]: 'a' }))}
                        className={`px-2 py-1 rounded border text-xs flex-1 text-left truncate ${choice === 'a' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                        {aVal} {isPrimaryA && <span className="opacity-60">(primary)</span>}
                      </button>
                      <button onClick={() => setFieldChoices(p => ({ ...p, [key as string]: 'b' }))}
                        className={`px-2 py-1 rounded border text-xs flex-1 text-left truncate ${choice === 'b' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                        {bVal} {!isPrimaryA && <span className="opacity-60">(primary)</span>}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-3 text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-600 mb-1">Automatically handled on merge:</p>
            <p>· All role flags OR'd — no flag lost</p>
            <p>· Tags combined into one set</p>
            <p>· Earliest date-added kept</p>
            <p>· All actions and interactions move to primary record</p>
            {hasDifferentEmails && <p>· <span className="font-medium text-gray-700">{secondary.email}</span> saved to alternative emails</p>}
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{error}</p>}

          <div className="flex gap-3">
            <button onClick={handleMerge} disabled={merging}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm">
              {merging ? 'Merging…' : `Merge — keep ${primary.full_name || primary.email || 'primary'}`}
            </button>
            <button onClick={() => onDismiss(pair.key)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm">
              Not duplicates
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MergeWizard() {
  const [pairs, setPairs] = useState<DupePair[]>([])
  const [loading, setLoading] = useState(true)
  const [mergedCount, setMergedCount] = useState(0)
  const [bulkMerging, setBulkMerging] = useState(false)
  const [bulkProgress, setBulkProgress] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const contacts = await fetchAllContacts()
    setPairs(computePairs(contacts))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Identical pairs: same email, same (or both empty) first+last name
  const identicalPairs = pairs.filter(p =>
    p.reason === 'email' &&
    p.a.email === p.b.email &&
    (p.a.first_name ?? '').toLowerCase().trim() === (p.b.first_name ?? '').toLowerCase().trim() &&
    (p.a.last_name ?? '').toLowerCase().trim() === (p.b.last_name ?? '').toLowerCase().trim()
  )

  async function mergeAllIdentical() {
    if (!identicalPairs.length) return
    setBulkMerging(true)
    let done = 0
    const keys = new Set<string>()
    for (const pair of identicalPairs) {
      setBulkProgress(`Merging ${done + 1} of ${identicalPairs.length}…`)
      const { a, b } = pair
      // Keep whichever has more data (non-null fields), defaulting to a
      const primary = a
      const secondary = b
      const mergedData: Record<string, unknown> = {}
      for (const { key } of CHOICE_FIELDS) {
        mergedData[key as string] = (primary[key] || secondary[key]) || null
      }
      for (const flag of BOOL_FLAGS) {
        mergedData[flag as string] = !!(primary[flag] || secondary[flag])
      }
      mergedData.tags = [...new Set([...(primary.tags ?? []), ...(secondary.tags ?? [])])]
      if (primary.date_added && secondary.date_added) {
        mergedData.date_added = primary.date_added < secondary.date_added ? primary.date_added : secondary.date_added
      } else {
        mergedData.date_added = primary.date_added || secondary.date_added
      }
      mergedData.notes = primary.notes || secondary.notes || null
      mergedData.alternative_emails = [...new Set([...(primary.alternative_emails ?? []), ...(secondary.alternative_emails ?? [])].filter(Boolean))]
      mergedData.email = primary.email
      try {
        const result = await mergeContacts({ primaryId: primary.id, secondaryId: secondary.id, mergedData })
        if (!result.error) { done++; keys.add(pair.key) }
      } catch { /* skip failed */ }
    }
    setPairs(prev => prev.filter(p => !keys.has(p.key)))
    setMergedCount(n => n + done)
    setBulkMerging(false)
    setBulkProgress('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400 text-sm">
        Loading contacts…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dedup Contacts</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {pairs.length} suspected duplicate pair{pairs.length !== 1 ? 's' : ''} remaining
            {mergedCount > 0 && ` · ${mergedCount} merged this session`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {identicalPairs.length > 0 && (
            <button
              onClick={mergeAllIdentical}
              disabled={bulkMerging}
              className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkMerging ? bulkProgress : `Merge all ${identicalPairs.length} identical`}
            </button>
          )}
          <button onClick={load} className="text-xs text-gray-400 hover:text-gray-600">↺ Refresh</button>
          <Link href="/contacts" className="text-gray-500 hover:text-gray-900 text-sm">← Contacts</Link>
        </div>
      </div>

      {pairs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">✓ No duplicates found</p>
          <Link href="/contacts" className="text-blue-600 hover:underline text-sm">← Back to contacts</Link>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Click <strong>Review</strong> on any row to compare. Use <strong>↺ Refresh</strong> to reload from the database.</p>
          {pairs.map(pair => (
            <PairRow
              key={pair.key}
              pair={pair}
              onDismiss={(key) => setPairs(prev => prev.filter(p => p.key !== key))}
              onMerged={(key) => { setPairs(prev => prev.filter(p => p.key !== key)); setMergedCount(n => n + 1) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
