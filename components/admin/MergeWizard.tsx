'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
    choices[key as string] = (!a[key] && b[key]) ? 'b' : 'a'
  }
  return choices
}

function PairRow({ pair, onDismiss }: { pair: DupePair; onDismiss: () => void }) {
  const router = useRouter()
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
    const aVal = a[key]
    const bVal = b[key]
    return aVal && bVal && aVal !== bVal
  })

  const hasDifferentEmails = a.email && b.email && a.email !== b.email

  async function handleMerge() {
    setMerging(true)
    setError('')

    const mergedData: Record<string, unknown> = {}

    for (const { key } of CHOICE_FIELDS) {
      const val = fieldChoices[key as string] === 'a' ? a[key] : b[key]
      mergedData[key as string] = val || null
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

    const altEmails = [
      ...(primary.alternative_emails ?? []),
      ...(secondary.alternative_emails ?? []),
    ]
    if (secondary.email && secondary.email !== primary.email) {
      altEmails.push(secondary.email)
    }
    mergedData.alternative_emails = [...new Set(altEmails.filter(Boolean))]
    mergedData.email = primary.email

    try {
      const result = await mergeContacts({ primaryId: primary.id, secondaryId: secondary.id, mergedData })
      if (result.error) {
        setError(result.error)
        setMerging(false)
        return
      }
      // Remove pair from local list immediately, refresh server cache in background
      onDismiss()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setMerging(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Header row — always visible */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${pair.reason === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
          {pair.reason}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-900">{a.full_name || a.email || '—'}</span>
          <span className="text-gray-400 mx-2 text-sm">vs</span>
          <span className="text-sm text-gray-600">{b.full_name || b.email || '—'}</span>
          {a.email !== b.email && a.email && b.email && (
            <span className="ml-2 text-xs text-orange-500">different emails</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { onDismiss() }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
          >
            Not duplicates
          </button>
          <button
            onClick={() => setOpen(o => !o)}
            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 font-medium"
          >
            {open ? 'Close ▲' : 'Review ▼'}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">

          {/* Two contact cards */}
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
                      <button onClick={() => flipPrimary(contact.id)} className="text-xs text-blue-600 hover:underline">
                        Make primary
                      </button>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{contact.full_name || '(no name)'}</p>
                  <div className="mt-2 space-y-0.5">
                    {[
                      { label: 'Email',        value: contact.email },
                      { label: 'Phone',        value: contact.phone },
                      { label: 'Town',         value: contact.town },
                      { label: 'State',        value: contact.state },
                      { label: 'ZIP',          value: contact.zip },
                      { label: 'Source',       value: contact.source },
                      { label: 'Added',        value: contact.date_added },
                      { label: 'Vol stage',    value: contact.volunteer_stage },
                      { label: 'Donor stage',  value: contact.donor_stage },
                      { label: 'Discord',      value: contact.discord_username },
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

          {/* Conflicting fields */}
          {conflicts.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Conflicting fields — click to pick</p>
              <div className="space-y-1.5">
                {conflicts.map(({ key, label }) => {
                  const aVal = String(a[key] ?? '')
                  const bVal = String(b[key] ?? '')
                  const choice = fieldChoices[key as string]
                  return (
                    <div key={key as string} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 text-xs w-24 shrink-0">{label}</span>
                      <button
                        onClick={() => setFieldChoices(p => ({ ...p, [key as string]: 'a' }))}
                        className={`px-2 py-1 rounded border text-xs flex-1 text-left truncate transition-colors ${choice === 'a' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}
                      >
                        {aVal} {isPrimaryA && <span className="opacity-60">(primary)</span>}
                      </button>
                      <button
                        onClick={() => setFieldChoices(p => ({ ...p, [key as string]: 'b' }))}
                        className={`px-2 py-1 rounded border text-xs flex-1 text-left truncate transition-colors ${choice === 'b' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}
                      >
                        {bVal} {!isPrimaryA && <span className="opacity-60">(primary)</span>}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Auto-merge summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-600 mb-1">Automatically handled on merge:</p>
            <p>· All role flags are OR'd — no flag will be lost</p>
            <p>· Tags are combined into one set</p>
            <p>· Earliest date-added is kept</p>
            <p>· All actions and interactions move to the primary record</p>
            {hasDifferentEmails && (
              <p>· <span className="font-medium text-gray-700">{secondary.email}</span> saved to alternative emails</p>
            )}
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleMerge}
              disabled={merging}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
            >
              {merging ? 'Merging…' : `Merge — keep ${primary.full_name || primary.email || 'primary'}`}
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            >
              Not duplicates
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MergeWizard({ pairs: initialPairs }: { pairs: DupePair[] }) {
  const [pairs, setPairs] = useState(initialPairs)
  const [mergedCount, setMergedCount] = useState(0)

  function dismiss(key: string) {
    setPairs(prev => prev.filter(p => p.key !== key))
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
        <Link href="/contacts" className="text-gray-500 hover:text-gray-900 text-sm">← Contacts</Link>
      </div>

      {pairs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">✓ No duplicates found</p>
          <Link href="/contacts" className="text-blue-600 hover:underline text-sm">← Back to contacts</Link>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Click <strong>Review</strong> on any row to compare and merge, or <strong>Not duplicates</strong> to dismiss.</p>
          {pairs.map(pair => (
            <PairRow
              key={pair.key}
              pair={pair}
              onDismiss={() => {
                dismiss(pair.key)
                setMergedCount(n => n) // no increment for dismissals
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
