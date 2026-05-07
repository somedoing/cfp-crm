'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const BOOL_FLAGS = [
  'is_volunteer', 'is_active_volunteer', 'is_signature_collector', 'is_donor',
  'is_media_contact', 'is_org_contact', 'is_candidate_partner', 'is_coalition_contact',
  'is_press_contact', 'newsletter_subscriber', 'email_opt_in', 'text_opt_in',
  'in_discord', 'is_supporter',
] as const

const TEXT_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'town', 'state', 'zip',
  'county', 'source', 'original_source_form', 'volunteer_stage', 'donor_stage',
  'signature_stage', 'discord_stage', 'media_stage', 'partner_stage',
  'discord_username', 'notes', 'priority', 'last_contact_date', 'last_contact_summary',
] as const

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
  source: string | null
  date_added: string | null
  volunteer_stage: string | null
  donor_stage: string | null
  priority: string | null
  notes: string | null
  is_volunteer: boolean
  is_donor: boolean
  is_signature_collector: boolean
  is_candidate_partner: boolean
  is_press_contact: boolean
  is_media_contact: boolean
  newsletter_subscriber: boolean
  in_discord: boolean
  [key: string]: any
}

function contactLabel(c: Contact) {
  return c.full_name || c.email || c.display_id || '(no name)'
}

function Field({ label, primary, secondary }: { label: string; primary: any; secondary: any }) {
  if (!primary && !secondary) return null
  const conflict = primary && secondary && String(primary) !== String(secondary)
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-1.5 pr-4 text-xs text-gray-400 w-32 align-top">{label}</td>
      <td className={`py-1.5 pr-4 text-sm align-top ${conflict ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
        {primary ?? <span className="text-gray-300">—</span>}
      </td>
      <td className={`py-1.5 text-sm align-top ${conflict ? 'text-orange-600' : 'text-gray-400'}`}>
        {secondary ?? <span className="text-gray-300">—</span>}
        {conflict && <span className="ml-1 text-xs text-orange-400">(will be discarded)</span>}
        {!primary && secondary && <span className="ml-1 text-xs text-green-500">(will fill in)</span>}
      </td>
    </tr>
  )
}

export default function MergeContacts({ primary }: { primary: Contact }) {
  const supabase = createClient()
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Contact[]>([])
  const [searching, setSearching] = useState(false)
  const [secondary, setSecondary] = useState<Contact | null>(null)
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState('')
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setSearching(true)
      const q = query.trim().toLowerCase()
      const { data } = await supabase
        .from('contacts')
        .select('id, display_id, first_name, last_name, full_name, email, phone, town, state, zip, source, date_added, volunteer_stage, donor_stage, priority, notes, is_volunteer, is_donor, is_signature_collector, is_candidate_partner, is_press_contact, is_media_contact, newsletter_subscriber, in_discord')
        .neq('id', primary.id)
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8)
      setResults((data ?? []) as Contact[])
      setSearching(false)
    }, 300)
  }, [query])

  async function doMerge() {
    if (!secondary) return
    setMerging(true)
    setError('')

    try {
      // Build merged field values: primary wins, secondary fills blanks
      const merged: Record<string, any> = {}
      for (const field of TEXT_FIELDS) {
        merged[field] = primary[field] ?? secondary[field] ?? null
      }
      for (const flag of BOOL_FLAGS) {
        merged[flag] = (primary[flag] || secondary[flag]) ?? false
      }
      merged.updated_at = new Date().toISOString()

      // 1. Update primary with merged data
      const { error: e1 } = await supabase.from('contacts').update(merged).eq('id', primary.id)
      if (e1) throw e1

      // 2. Move actions from secondary → primary
      await supabase.from('actions').update({ contact_id: primary.id }).eq('contact_id', secondary.id)

      // 3. Move interactions from secondary → primary
      await supabase.from('interactions').update({ contact_id: primary.id }).eq('contact_id', secondary.id)

      // 4. Delete secondary
      const { error: e4 } = await supabase.from('contacts').delete().eq('id', secondary.id)
      if (e4) throw e4

      router.push(`/contacts/${primary.id}`)
    } catch (e: any) {
      setError(e?.message ?? 'Merge failed')
      setMerging(false)
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href={`/contacts/${primary.id}`} className="text-gray-500 hover:text-gray-900 text-sm">
        ← Back to {contactLabel(primary)}
      </Link>

      {!secondary ? (
        /* Search step */
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-600 mb-3">
              Keeping: <span className="font-semibold text-gray-900">{contactLabel(primary)}</span>
              {primary.email && <span className="text-gray-400"> · {primary.email}</span>}
            </p>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search for the duplicate by name or email…"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {searching && <p className="text-gray-400 text-sm px-1">Searching…</p>}

          {results.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {results.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSecondary(r)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">{contactLabel(r)}</div>
                  <div className="text-sm text-gray-400 flex gap-3 mt-0.5">
                    {r.email && <span>{r.email}</span>}
                    {r.phone && <span>{r.phone}</span>}
                    {r.town && <span>{r.town}, {r.state}</span>}
                    {r.date_added && <span>Added {r.date_added}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="text-gray-400 text-sm px-1">No contacts found matching "{query}"</p>
          )}
        </div>
      ) : (
        /* Comparison + confirm step */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Primary */}
            <div className="bg-white rounded-xl border-2 border-blue-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-blue-100 text-blue-700">Keeping</Badge>
                <span className="text-xs text-gray-400">{primary.display_id}</span>
              </div>
              <h3 className="font-semibold text-gray-900">{contactLabel(primary)}</h3>
              {primary.email && <p className="text-sm text-gray-500">{primary.email}</p>}
              {primary.phone && <p className="text-sm text-gray-500">{primary.phone}</p>}
              {primary.date_added && <p className="text-xs text-gray-400 mt-1">Added {primary.date_added}</p>}
            </div>

            {/* Secondary */}
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-red-50 text-red-600 border-red-200">Will be deleted</Badge>
                <span className="text-xs text-gray-400">{secondary.display_id}</span>
              </div>
              <h3 className="font-semibold text-gray-900">{contactLabel(secondary)}</h3>
              {secondary.email && <p className="text-sm text-gray-500">{secondary.email}</p>}
              {secondary.phone && <p className="text-sm text-gray-500">{secondary.phone}</p>}
              {secondary.date_added && <p className="text-xs text-gray-400 mt-1">Added {secondary.date_added}</p>}
              <button
                onClick={() => setSecondary(null)}
                className="text-xs text-gray-400 hover:text-gray-600 mt-2"
              >
                Choose different contact
              </button>
            </div>
          </div>

          {/* Field comparison */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Field comparison</p>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <td className="pb-2 text-xs text-gray-400 w-32"></td>
                  <td className="pb-2 text-xs font-medium text-blue-600">Keeping (primary)</td>
                  <td className="pb-2 text-xs font-medium text-red-500">Deleting (duplicate)</td>
                </tr>
              </thead>
              <tbody>
                <Field label="Name" primary={contactLabel(primary)} secondary={contactLabel(secondary)} />
                <Field label="Email" primary={primary.email} secondary={secondary.email} />
                <Field label="Phone" primary={primary.phone} secondary={secondary.phone} />
                <Field label="Location" primary={[primary.town, primary.state].filter(Boolean).join(', ') || null} secondary={[secondary.town, secondary.state].filter(Boolean).join(', ') || null} />
                <Field label="Source" primary={primary.source} secondary={secondary.source} />
                <Field label="Added" primary={primary.date_added} secondary={secondary.date_added} />
                <Field label="Vol stage" primary={primary.volunteer_stage} secondary={secondary.volunteer_stage} />
                <Field label="Donor stage" primary={primary.donor_stage} secondary={secondary.donor_stage} />
                <Field label="Priority" primary={primary.priority} secondary={secondary.priority} />
                <Field label="Notes" primary={primary.notes} secondary={secondary.notes} />
              </tbody>
            </table>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Boolean flags (volunteer, donor, press, etc.) are merged with OR — if either contact has a flag set, the merged contact keeps it.
              All actions and interaction history from the duplicate will be moved to the surviving contact.
            </p>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex items-center gap-3">
            <Button
              onClick={doMerge}
              disabled={merging}
              className="bg-red-600 hover:bg-red-700"
            >
              {merging ? 'Merging…' : `Merge and delete ${contactLabel(secondary)}`}
            </Button>
            <button
              onClick={() => setSecondary(null)}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
