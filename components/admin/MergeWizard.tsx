'use client'

import { useState } from 'react'
import Link from 'next/link'
import { mergeContacts } from '@/app/(admin)/contacts/merge/actions'

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

function defaultChoices(a: Contact, b: Contact): Record<string, 'a' | 'b'> {
  const choices: Record<string, 'a' | 'b'> = {}
  for (const { key } of CHOICE_FIELDS) {
    // Default to A, but switch to B if A is blank and B isn't
    choices[key as string] = (!a[key] && b[key]) ? 'b' : 'a'
  }
  return choices
}

export default function MergeWizard({ pairs: initialPairs }: { pairs: DupePair[] }) {
  const [pairs, setPairs] = useState(initialPairs)
  const [activePair, setActivePair] = useState<DupePair | null>(null)
  const [primaryId, setPrimaryId] = useState('')
  const [fieldChoices, setFieldChoices] = useState<Record<string, 'a' | 'b'>>({})
  const [merging, setMerging] = useState(false)
  const [mergedCount, setMergedCount] = useState(0)
  const [error, setError] = useState('')

  function openPair(pair: DupePair) {
    setActivePair(pair)
    setPrimaryId(pair.a.id)
    setFieldChoices(defaultChoices(pair.a, pair.b))
    setError('')
  }

  function flipPrimary(newId: string) {
    if (newId === primaryId) return
    setPrimaryId(newId)
    setFieldChoices(prev => {
      const next: Record<string, 'a' | 'b'> = {}
      for (const k of Object.keys(prev)) next[k] = prev[k] === 'a' ? 'b' : 'a'
      return next
    })
  }

  async function handleMerge() {
    if (!activePair) return
    setMerging(true)
    setError('')

    const { a, b } = activePair
    const isPrimaryA = primaryId === a.id
    const primary = isPrimaryA ? a : b
    const secondary = isPrimaryA ? b : a

    const mergedData: Record<string, unknown> = {}

    // User-chosen fields
    for (const { key } of CHOICE_FIELDS) {
      const val = fieldChoices[key as string] === 'a' ? a[key] : b[key]
      mergedData[key as string] = val || null
    }

    // Boolean flags: OR
    for (const flag of BOOL_FLAGS) {
      mergedData[flag as string] = !!(a[flag] || b[flag])
    }

    // Tags: union
    mergedData.tags = [...new Set([...(a.tags ?? []), ...(b.tags ?? [])])]

    // Date added: keep earliest
    if (a.date_added && b.date_added) {
      mergedData.date_added = a.date_added < b.date_added ? a.date_added : b.date_added
    } else {
      mergedData.date_added = a.date_added || b.date_added
    }

    // Notes: combine if both have content
    if (primary.notes && secondary.notes && primary.notes !== secondary.notes) {
      mergedData.notes = `${primary.notes}\n\n--- merged from duplicate ---\n${secondary.notes}`
    } else {
      mergedData.notes = primary.notes || secondary.notes || null
    }

    // Alternative emails: collect secondary email + any existing alternative_emails from both
    const altEmails = [
      ...(primary.alternative_emails ?? []),
      ...(secondary.alternative_emails ?? []),
    ]
    if (secondary.email && secondary.email !== primary.email) {
      altEmails.push(secondary.email)
    }
    mergedData.alternative_emails = [...new Set(altEmails.filter(Boolean))]
    mergedData.email = primary.email

    // full_name: rebuild from chosen first/last
    const fn = (mergedData.first_name as string || '').trim()
    const ln = (mergedData.last_name as string || '').trim()
    mergedData.full_name = [fn, ln].filter(Boolean).join(' ') || primary.full_name

    const result = await mergeContacts({ primaryId: primary.id, secondaryId: secondary.id, mergedData })

    if ('error' in result && result.error) {
      setError(result.error)
      setMerging(false)
      return
    }

    setPairs(prev => prev.filter(p => p.key !== activePair.key))
    setMergedCount(n => n + 1)
    setActivePair(null)
    setMerging(false)
  }

  const primary = activePair ? (primaryId === activePair.a.id ? activePair.a : activePair.b) : null
  const secondary = activePair ? (primaryId === activePair.a.id ? activePair.b : activePair.a) : null

  const conflicts = activePair
    ? CHOICE_FIELDS.filter(({ key }) => {
        const aVal = activePair.a[key]
        const bVal = activePair.b[key]
        return aVal && bVal && aVal !== bVal
      })
    : []

  const hasDifferentEmails = activePair?.a.email && activePair?.b.email &&
    activePair.a.email !== activePair.b.email

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dedup Contacts</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {pairs.length} duplicate pair{pairs.length !== 1 ? 's' : ''} remaining
            {mergedCount > 0 && ` · ${mergedCount} merged this session`}
          </p>
        </div>
        <Link href="/contacts" className="text-gray-500 hover:text-gray-900 text-sm">← Contacts</Link>
      </div>

      {pairs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">✓ No duplicates found</p>
          <Link href="/contacts" className="text-blue-600 hover:underline text-sm">← Back to contacts</Link>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 items-start">

          {/* Pair list */}
          <div className="w-full lg:w-64 shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 border-b bg-gray-50 text-xs text-gray-500 font-medium uppercase tracking-wide">
              {pairs.length} pairs
            </div>
            <div className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {pairs.map(pair => (
                <button
                  key={pair.key}
                  onClick={() => openPair(pair)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${activePair?.key === pair.key ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${pair.reason === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {pair.reason}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{pair.a.full_name || pair.a.email || '—'}</p>
                  <p className="text-xs text-gray-400 truncate">{pair.b.full_name || pair.b.email || '—'}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Merge panel */}
          <div className="flex-1 min-w-0">
            {!activePair ? (
              <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-24 text-gray-400 text-sm">
                ← Select a pair to review
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">

                {/* Two contact cards */}
                <div className="grid grid-cols-2 gap-3">
                  {[activePair.a, activePair.b].map(contact => {
                    const isPrimary = contact.id === primaryId
                    return (
                      <div key={contact.id} className={`rounded-lg border-2 p-3 transition-all ${isPrimary ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPrimary ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            {isPrimary ? '★ Primary' : 'Secondary'}
                          </span>
                          {!isPrimary && (
                            <button onClick={() => flipPrimary(contact.id)} className="text-xs text-blue-600 hover:underline">
                              Make primary
                            </button>
                          )}
                        </div>
                        <p className="font-semibold text-gray-900 truncate">{contact.full_name || '(no name)'}</p>
                        <p className="text-xs text-gray-500 truncate">{contact.email || '—'}</p>
                        <p className="text-xs text-gray-400">{contact.phone || '—'}</p>
                        <p className="text-xs text-gray-400">{[contact.town, contact.state].filter(Boolean).join(', ') || '—'}</p>
                        {contact.date_added && <p className="text-xs text-gray-400 mt-1">Added {contact.date_added}</p>}
                        {contact.source && <p className="text-xs text-gray-400 truncate">{contact.source}</p>}
                      </div>
                    )
                  })}
                </div>

                {/* Conflicting fields */}
                {conflicts.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Conflicting fields — click to pick</p>
                    <div className="space-y-1.5">
                      {conflicts.map(({ key, label }) => {
                        const aVal = String(activePair.a[key] ?? '')
                        const bVal = String(activePair.b[key] ?? '')
                        const choice = fieldChoices[key as string]
                        const primaryChoice = primaryId === activePair.a.id ? 'a' : 'b'
                        return (
                          <div key={key as string} className="flex items-center gap-2 text-sm">
                            <span className="text-gray-400 text-xs w-24 shrink-0">{label}</span>
                            <button
                              onClick={() => setFieldChoices(p => ({ ...p, [key as string]: 'a' }))}
                              className={`px-2 py-1 rounded border text-xs flex-1 text-left truncate transition-colors ${
                                choice === 'a' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                              }`}
                            >
                              {aVal} {primaryChoice === 'a' && <span className="opacity-60">(primary)</span>}
                            </button>
                            <button
                              onClick={() => setFieldChoices(p => ({ ...p, [key as string]: 'b' }))}
                              className={`px-2 py-1 rounded border text-xs flex-1 text-left truncate transition-colors ${
                                choice === 'b' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                              }`}
                            >
                              {bVal} {primaryChoice === 'b' && <span className="opacity-60">(primary)</span>}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Notes preview */}
                {(activePair.a.notes || activePair.b.notes) && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Notes (combined on merge)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[activePair.a, activePair.b].map(c => (
                        <div key={c.id} className="text-xs text-gray-600 bg-gray-50 rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">
                          {c.notes || <span className="text-gray-300 italic">empty</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Auto-merge summary */}
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                  <p className="font-medium text-gray-600 mb-1">Automatically handled:</p>
                  <p>· All role flags are OR'd — no flag will be lost</p>
                  <p>· Tags are combined into one set</p>
                  <p>· Earliest date-added is kept</p>
                  <p>· All actions and interactions move to the primary record</p>
                  {hasDifferentEmails && (
                    <p>· <span className="font-medium text-gray-700">{secondary?.email}</span> saved to alternative emails on the merged contact</p>
                  )}
                </div>

                {error && <p className="text-red-600 text-sm">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleMerge}
                    disabled={merging}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {merging ? 'Merging…' : 'Merge contacts'}
                  </button>
                  <button
                    onClick={() => setActivePair(null)}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
