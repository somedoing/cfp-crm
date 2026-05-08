'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_FORMS = [
  'Squarespace Contacts Export',
  'Volunteer Interest Form',
  'Signature Collector Signup',
  'Newsletter Signup',
  'Donation Form',
  'General Contact Form',
  'Event Signup',
  'Pledge Form',
  'Other',
]

const CRM_FIELDS = [
  { value: 'ignore', label: '— Ignore this column —' },
  { value: 'full_name', label: 'Full Name → split into first + last' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'town', label: 'Town / City' },
  { value: 'state', label: 'State' },
  { value: 'zip', label: 'ZIP Code' },
  { value: 'county', label: 'County' },
  { value: 'congressional_district', label: 'Congressional District' },
  { value: 'notes', label: 'Notes (multiple columns will be combined)' },
  { value: 'discord_username', label: 'Discord Username' },
  { value: 'date_added', label: 'Date Added / Submission Date' },
  { value: 'mailing_lists', label: 'Mailing Lists → auto-set role flags' },
  { value: 'accepts_marketing', label: 'Accepts Marketing → Email Opt-In' },
  { value: 'text_opt_in', label: 'Text Consent → Text Opt-In' },
  { value: 'donation_count', label: 'Donation Count → marks as donor' },
  { value: 'donation_amount', label: 'Donation Amount → marks as donor' },
  { value: 'newsletter_subscriber', label: 'Newsletter Subscriber (true/false)' },
  { value: 'is_volunteer', label: 'Is Volunteer (true/false)' },
  { value: 'is_donor', label: 'Is Donor (true/false)' },
  { value: 'is_supporter', label: 'Is Supporter (true/false)' },
  { value: 'is_signature_collector', label: 'Is Signature Collector (true/false)' },
  { value: 'is_media_contact', label: 'Is Media Contact (true/false)' },
  { value: 'volunteer_stage', label: 'Volunteer Stage' },
  { value: 'donor_stage', label: 'Donor Stage' },
  { value: 'support_level', label: 'Support Level (1–5)' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type ParsedRow = Record<string, string>
type DupeMatch = { contact_id: string; full_name: string; email: string }
type ReviewRow = { data: ParsedRow; _action: 'create' | 'merge' | 'skip'; _match?: DupeMatch; roles: string[] }
type FieldMap = Record<string, string> // csvColumn → crmField

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): ParsedRow[] {
  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { field += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { current.push(field.trim()); field = '' }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++
        current.push(field.trim())
        if (current.some(f => f !== '')) rows.push(current)
        current = []; field = ''
      } else { field += ch }
    }
  }
  if (field || current.length) {
    current.push(field.trim())
    if (current.some(f => f !== '')) rows.push(current)
  }

  if (rows.length < 2) return []
  const headers = rows[0]
  return rows.slice(1).map(values =>
    Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  )
}

// ─── Smart default field mapping ──────────────────────────────────────────────

function guessFieldMapping(columnName: string, sampleValue?: string): string {
  const col = columnName.toLowerCase().trim()
  // Blank-header column — if the sample value looks like a phone number, treat it as phone
  if (!col && sampleValue && /^\+?[\d\s()\-\.]{7,}$/.test(sampleValue.trim())) return 'phone'
  // Squarespace form timestamp column (named after timezone e.g. "America/New_York")
  if (col.startsWith('america/') || col.startsWith('us/') || col.startsWith('utc')) return 'date_added'
  if (col === 'email') return 'email'
  if (col === 'name') return 'full_name'
  if (col === 'first name' || col === 'first_name' || col === 'firstname') return 'first_name'
  if (col === 'last name' || col === 'last_name' || col === 'lastname') return 'last_name'
  // Shipping = physical address → map to CRM fields
  if (col === 'shipping phone number') return 'phone'
  if (col === 'shipping city') return 'town'
  if (col === 'shipping province/state') return 'state'
  if (col === 'shipping zip') return 'zip'
  // Billing = payment address → ignore
  if (col.startsWith('billing')) return 'ignore'
  if (col === 'shipping name' || col === 'shipping address 1' || col === 'shipping address 2' || col === 'shipping country') return 'ignore'
  // Generic address
  if (col === 'phone' || col === 'phone number' || col === 'mobile') return 'phone'
  if (col === 'city' || col === 'town' || col === 'your city/town' || col === 'your town/city' || col === 'your town' || col === 'your city') return 'town'
  if (col === 'state' || col === 'province') return 'state'
  if (col === 'zip' || col === 'zip code' || col === 'postal code') return 'zip'
  if (col === 'county') return 'county'
  if (col === 'congressional district') return 'congressional_district'
  // Role/opt-in flags
  if (col === 'mailing lists') return 'mailing_lists'
  if (col === 'accepts marketing') return 'accepts_marketing'
  if (col === 'text/phone' || col.includes('text consent') || col.includes('receive text') || col.includes('sms')) return 'text_opt_in'
  if (col === 'donation count') return 'donation_count'
  if (col === 'total donation amount') return 'donation_amount'
  if (col === 'created on' || col === 'subscriber since' || col === 'member since') return 'date_added'
  if (col === 'last donation date' || col === 'last order date') return 'last_donation_date'
  if (col === 'subscriber source') return 'subscriber_source'
  // Notes — volunteer interest fields, messages, free text
  if (col === 'notes' || col === 'note' || col === 'message' || col === 'tags') return 'notes'
  if (col === 'interest area(s)' || col === 'interest areas' || col === 'interests') return 'notes'
  if (col === 'not talking to humans' || col === 'talking to humans') return 'notes'
  if (col.startsWith('where') && col.includes('collect')) return 'notes'
  if (col.includes('discord')) return 'discord_username'
  return 'ignore'
}

function buildDefaultFieldMap(headers: string[], sampleRow: ParsedRow): FieldMap {
  return Object.fromEntries(headers.map(h => [h, guessFieldMapping(h, sampleRow[h])]))
}

// ─── NH Town detection ────────────────────────────────────────────────────────

const NH_TOWNS = new Set([
  'alton', 'amherst', 'antrim', 'atkinson', 'auburn', 'barnstead', 'barrington',
  'bartlett', 'bath', 'bedford', 'belmont', 'berlin', 'boscawen', 'bow',
  'bradford', 'brentwood', 'brookline', 'canaan', 'candia', 'canterbury',
  'charlestown', 'chester', 'chesterfield', 'chichester', 'claremont', 'colebrook',
  'concord', 'conway', 'cornish', 'croydon', 'danville', 'deering', 'derry',
  'dover', 'dunbarton', 'durham', 'east kingston', 'effingham', 'enfield',
  'epping', 'epsom', 'exeter', 'farmington', 'fitzwilliam', 'francestown',
  'franklin', 'freedom', 'fremont', 'gilford', 'gilmanton', 'goffstown',
  'gorham', 'grafton', 'grantham', 'greenfield', 'greenland', 'hampstead',
  'hampton', 'hampton falls', 'hanover', 'harrisville', 'haverhill', 'henniker',
  'hill', 'hillsborough', 'hollis', 'hooksett', 'hopkinton', 'hudson', 'jackson',
  'jaffrey', 'jefferson', 'keene', 'kensington', 'kingston', 'laconia', 'lancaster',
  'lebanon', 'lincoln', 'lisbon', 'litchfield', 'littleton', 'londonderry',
  'loudon', 'lyme', 'lyndeborough', 'madison', 'manchester', 'marlborough',
  'mason', 'meredith', 'merrimack', 'milford', 'mont vernon', 'moultonborough',
  'nashua', 'nelson', 'new boston', 'new durham', 'new hampton', 'new ipswich',
  'new london', 'newbury', 'newfields', 'newington', 'newmarket', 'newport',
  'newton', 'north conway', 'north hampton', 'northfield', 'northumberland',
  'northwood', 'nottingham', 'orange', 'orford', 'ossipee', 'pelham', 'pembroke',
  'penacook', 'peterborough', 'piermont', 'pittsfield', 'pittsburg', 'plainfield',
  'plaistow', 'plymouth', 'portsmouth', 'raymond', 'rindge', 'rochester',
  'rollinsford', 'rye', 'salem', 'sanbornton', 'sandown', 'sandwich', 'seabrook',
  'somersworth', 'springfield', 'stratford', 'stratham', 'sunapee', 'sutton',
  'swanzey', 'tamworth', 'temple', 'tilton', 'troy', 'tuftonboro', 'wakefield',
  'walpole', 'warner', 'weare', 'westmoreland', 'whitefield', 'wilton',
  'winchester', 'windham', 'wolfeboro', 'woodstock', 'west lebanon',
])

function computeAutoTags(contact: Record<string, unknown>): string[] {
  const tags: string[] = []
  const year = contact.date_added ? new Date(contact.date_added as string).getFullYear() : null
  const suffix = year ? ` ${year}` : ''
  const sourceForm = (contact.original_source_form as string) ?? ''

  if (contact.newsletter_subscriber) tags.push('Newsletter')

  if (sourceForm === 'Pledge Form') {
    tags.push(`CFP Pledge${suffix}`)
  } else if (contact.is_volunteer) {
    tags.push(`Volunteer Form${suffix}`)
  }

  if (contact.is_signature_collector) tags.push(`Sig Collector${suffix}`)
  if (contact.is_donor) tags.push(`One-Time Donor${suffix}`)
  if (contact.is_media_contact || contact.is_press_contact) tags.push('Press')

  return tags
}

function detectNHTown(text: string): string | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const town of NH_TOWNS) {
    const escaped = town.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${escaped}\\b`).test(lower)) {
      return town.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }
  }
  return null
}

// ─── Role parsing ─────────────────────────────────────────────────────────────

function parseMailingLists(value: string): Record<string, unknown> {
  const lists = value.split(',').map(l => l.trim().toLowerCase())
  const flags: Record<string, unknown> = {}
  if (lists.some(l => l.includes('volunteer'))) { flags.is_volunteer = true; flags.volunteer_stage = 'New' }
  if (lists.some(l => l.includes('newsletter') || l.includes('campaign newsletter'))) { flags.newsletter_subscriber = true; flags.email_opt_in = true }
  if (lists.some(l => l.includes('media') || l.includes('press'))) { flags.is_media_contact = true }
  if (lists.some(l => l.includes('donor'))) { flags.is_donor = true; flags.donor_stage = 'Donated' }
  if (lists.some(l => l.includes('signature') || l.includes('petition'))) { flags.is_signature_collector = true; flags.signature_stage = 'New lead' }
  if (lists.some(l => l.includes('coalition'))) { flags.is_coalition_contact = true }
  if (lists.some(l => l.includes('partner'))) { flags.is_candidate_partner = true }
  if (lists.some(l => l.includes('discord'))) { flags.in_discord = true }
  return flags
}

function boolVal(v: string): boolean {
  return v?.toLowerCase() === 'true' || v?.toLowerCase() === 'yes' || v === '1'
}

// ─── Apply field map to a row ──────────────────────────────────────────────────

function applyFieldMap(row: ParsedRow, fieldMap: FieldMap, sourceForm: string): Record<string, unknown> {
  const contact: Record<string, unknown> = {
    source: sourceForm,
    original_source_form: sourceForm,
    updated_at: new Date().toISOString(),
  }
  const notesParts: string[] = []

  for (const [csvCol, crmField] of Object.entries(fieldMap)) {
    const val = row[csvCol] ?? ''
    if (!val || crmField === 'ignore') continue

    switch (crmField) {
      case 'full_name': {
        const s = val.trim()
        if (s.includes(',')) {
          // "Last, First" format
          const [last, ...firstParts] = s.split(',').map(p => p.trim())
          contact.first_name = firstParts.join(' ') || ''
          contact.last_name = last || ''
        } else {
          const parts = s.split(/\s+/)
          contact.first_name = parts[0] ?? ''
          contact.last_name = parts.slice(1).join(' ') || ''
        }
        break
      }
      case 'notes':
        notesParts.push(`${csvCol}: ${val}`)
        break
      case 'mailing_lists':
        Object.assign(contact, parseMailingLists(val))
        break
      case 'accepts_marketing':
        if (boolVal(val)) { contact.email_opt_in = true; contact.newsletter_subscriber = true }
        break
      case 'text_opt_in':
        // Field has consent text if opted in, empty if not
        if (val.length > 3) contact.text_opt_in = true
        break
      case 'donation_count':
        if (parseInt(val) > 0) {
          contact.is_donor = true; contact.donor_stage = 'Donated'
          contact._donation_count = parseInt(val)
        }
        break
      case 'donation_amount':
        if (parseFloat(val) > 0) {
          contact.is_donor = true; contact.donor_stage = 'Donated'
          contact._donation_amount = parseFloat(val)
        }
        break
      case 'date_added': {
        // Squarespace format: "May 7, 2026 at 10:52:02 AM EDT" — "at" breaks JS Date parser
        const cleaned = val.replace(/\s+at\s+/i, ' ').replace(/\s+(EDT|EST|CDT|CST|PDT|PST|MDT|MST)\s*$/i, '')
        const parsed = new Date(cleaned)
        if (!isNaN(parsed.getTime())) contact.date_added = parsed.toISOString().split('T')[0]
        break
      }
      case 'last_donation_date': {
        const cleaned = val.replace(/\s+at\s+/i, ' ').replace(/\s+(EDT|EST|CDT|CST|PDT|PST|MDT|MST)\s*$/i, '')
        const parsed = new Date(cleaned)
        if (!isNaN(parsed.getTime())) contact._last_donation_date = parsed.toISOString().split('T')[0]
        break
      }
      case 'subscriber_source':
        if (val) notesParts.push(`Squarespace source: ${val}`)
        break
      case 'newsletter_subscriber':
      case 'is_volunteer':
      case 'is_donor':
      case 'is_supporter':
      case 'is_signature_collector':
      case 'is_media_contact':
        contact[crmField] = boolVal(val)
        break
      default:
        contact[crmField] = val || null
    }
  }

  if (notesParts.length > 0) contact.notes = notesParts.join('\n')

  // Source-form role defaults (for non-Squarespace forms)
  if (sourceForm === 'Volunteer Interest Form') { contact.is_volunteer = true; if (!contact.volunteer_stage) contact.volunteer_stage = 'New' }
  if (sourceForm === 'Signature Collector Signup') { contact.is_volunteer = true; contact.is_signature_collector = true; if (!contact.signature_stage) contact.signature_stage = 'New lead' }
  if (sourceForm === 'Newsletter Signup') { contact.newsletter_subscriber = true; contact.email_opt_in = true }
  if (sourceForm === 'Donation Form' && !contact.is_donor) { contact.donor_stage = contact.donor_stage ?? 'Prospect' }
  if (sourceForm === 'Pledge Form') { contact.is_volunteer = true; if (!contact.volunteer_stage) contact.volunteer_stage = 'New' }

  // NH town detection: if no town found, check notes for NH town names
  if (!contact.town && contact.notes) {
    const detected = detectNHTown(contact.notes as string)
    if (detected) {
      contact.town = detected
      if (!contact.state) contact.state = 'NH'
    }
  }

  contact.tags = computeAutoTags(contact)

  return contact
}

function normalizeEmail(email: string) {
  return email?.toLowerCase().trim() ?? ''
}

function getRoleLabels(row: ParsedRow, fieldMap: FieldMap): string[] {
  const mailingCol = Object.entries(fieldMap).find(([, v]) => v === 'mailing_lists')?.[0]
  if (!mailingCol || !row[mailingCol]) return []
  return row[mailingCol].split(',').map(l => l.trim()).filter(Boolean)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportUploader() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [sourceForm, setSourceForm] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [fieldMap, setFieldMap] = useState<FieldMap>({})
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([])
  const [step, setStep] = useState<'upload' | 'mapping' | 'review' | 'done'>('upload')
  const [loading, setLoading] = useState(false)
  const [filename, setFilename] = useState('')
  const [processedCount, setProcessedCount] = useState(0)
  const [autoActions, setAutoActions] = useState(true)

  function reset() {
    setStep('upload'); setRows([]); setHeaders([]); setFieldMap({})
    setReviewRows([]); setFilename(''); setSourceForm(''); setProcessedCount(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    const text = await file.text()
    const parsed = parseCSV(text)
    if (!parsed.length) return
    const h = Object.keys(parsed[0])
    setRows(parsed)
    setHeaders(h)
    setFieldMap(buildDefaultFieldMap(h, parsed[0]))
    if (parsed[0] && 'Mailing Lists' in parsed[0]) setSourceForm('Squarespace Contacts Export')
  }

  async function handlePreview() {
    setLoading(true)
    const emailCol = Object.entries(fieldMap).find(([, v]) => v === 'email')?.[0]

    // Deduplicate within the CSV itself — keep the first occurrence of each email,
    // skip later rows for the same email (they're the same person submitted twice)
    const seenEmails = new Set<string>()
    const deduped = rows.filter(row => {
      const email = emailCol ? normalizeEmail(row[emailCol] ?? '') : ''
      if (!email) return true // no email — can't dedupe, keep it
      if (seenEmails.has(email)) return false
      seenEmails.add(email)
      return true
    })

    const emails = emailCol
      ? deduped.map(r => normalizeEmail(r[emailCol] ?? '')).filter(Boolean)
      : []

    const { data: existingContacts } = emails.length
      ? await supabase.from('contacts').select('id, full_name, email').in('email', emails)
      : { data: [] }

    const emailMap = new Map((existingContacts ?? []).map(c => [normalizeEmail(c.email), c]))

    const reviewed: ReviewRow[] = deduped.map(row => {
      const email = emailCol ? normalizeEmail(row[emailCol] ?? '') : ''
      const match = email ? emailMap.get(email) : undefined
      const roles = getRoleLabels(row, fieldMap)
      if (match) return { data: row, _action: 'merge', _match: { contact_id: match.id, full_name: match.full_name, email: match.email }, roles }
      return { data: row, _action: 'create', roles }
    })

    setReviewRows(reviewed)
    setStep('review')
    setLoading(false)
  }

  function setRowAction(idx: number, action: 'create' | 'merge' | 'skip') {
    setReviewRows(prev => prev.map((r, i) => i === idx ? { ...r, _action: action } : r))
  }

  async function handleProcess() {
    setLoading(true)
    let processed = 0

    const { data: importRecord } = await supabase
      .from('imports')
      .insert({ filename, source_form: sourceForm, row_count: rows.length, status: 'reviewing' })
      .select().single()
    if (!importRecord) { setLoading(false); return }

    for (const row of reviewRows) {
      if (row._action === 'skip') continue

      const contactData = applyFieldMap(row.data, fieldMap, sourceForm)
      const firstName = (contactData.first_name as string) ?? ''
      const donationCount = contactData._donation_count as number | undefined
      const donationAmount = contactData._donation_amount as number | undefined
      const lastDonationDate = contactData._last_donation_date as string | undefined
      delete contactData._donation_count
      delete contactData._donation_amount
      delete contactData._last_donation_date

      let contactId: string
      if (row._action === 'merge' && row._match) {
        // Non-destructive merge: fetch existing, fill blanks, OR flags, append notes
        const { data: existing } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', row._match.contact_id)
          .single()

        const patch: Record<string, any> = { updated_at: new Date().toISOString() }

        for (const [key, newVal] of Object.entries(contactData)) {
          if (key === 'updated_at' || key === 'source' || key === 'original_source_form') continue
          const existingVal = existing?.[key]

          if (key === 'notes') {
            if (newVal && existingVal) {
              patch.notes = `${existingVal}\n\n--- imported ${new Date().toLocaleDateString()} ---\n${newVal}`
            } else if (newVal && !existingVal) {
              patch.notes = newVal
            }
          } else if (key === 'tags') {
            const existingTags: string[] = Array.isArray(existingVal) ? existingVal : []
            const newTags: string[] = Array.isArray(newVal) ? newVal : []
            const merged = [...new Set([...existingTags, ...newTags])]
            if (merged.length > existingTags.length) patch.tags = merged
          } else if (typeof newVal === 'boolean') {
            // Only promote to true, never demote
            if (newVal === true && existingVal !== true) patch[key] = true
          } else if (newVal !== null && newVal !== '' && (existingVal === null || existingVal === '' || existingVal === undefined)) {
            patch[key] = newVal
          }
        }

        if (Object.keys(patch).length > 1) {
          await supabase.from('contacts').update(patch).eq('id', row._match.contact_id)
        }
        contactId = row._match.contact_id
      } else {
        const { data: newContact } = await supabase.from('contacts').insert(contactData).select('id').single()
        if (!newContact) continue
        contactId = newContact.id
      }

      // Log donation interaction if donation data present
      if (donationCount || donationAmount) {
        let shouldLog = row._action === 'create'
        if (row._action === 'merge') {
          const { count } = await supabase
            .from('interactions')
            .select('id', { count: 'exact', head: true })
            .eq('contact_id', contactId)
            .eq('interaction_type', 'Donation')
          shouldLog = (count ?? 0) === 0
        }
        if (shouldLog) {
          const parts: string[] = []
          if (donationCount) parts.push(`${donationCount} donation${donationCount !== 1 ? 's' : ''}`)
          if (donationAmount) parts.push(`$${donationAmount.toFixed(2)} total`)
          await supabase.from('interactions').insert({
            contact_id: contactId,
            interaction_type: 'Donation',
            direction: 'Inbound',
            interaction_date: lastDonationDate || (contactData.date_added as string) || new Date().toISOString().split('T')[0],
            summary: parts.join(' — '),
            notes: `From ${sourceForm} import`,
          })
        }
      }

      // Log volunteer signup interaction
      if (contactData.is_volunteer) {
        let shouldLog = row._action === 'create'
        if (row._action === 'merge') {
          const { count } = await supabase
            .from('interactions')
            .select('id', { count: 'exact', head: true })
            .eq('contact_id', contactId)
            .eq('interaction_type', 'Volunteer Signup')
          shouldLog = (count ?? 0) === 0
        }
        if (shouldLog) {
          await supabase.from('interactions').insert({
            contact_id: contactId,
            interaction_type: 'Volunteer Signup',
            direction: 'Inbound',
            interaction_date: (contactData.date_added as string) || new Date().toISOString().split('T')[0],
            summary: sourceForm !== 'Squarespace Contacts Export' ? `via ${sourceForm}` : 'Volunteer (from Squarespace)',
          })
        }
      }

      // Log sig collector signup interaction
      if (contactData.is_signature_collector) {
        let shouldLog = row._action === 'create'
        if (row._action === 'merge') {
          const { count } = await supabase
            .from('interactions')
            .select('id', { count: 'exact', head: true })
            .eq('contact_id', contactId)
            .eq('interaction_type', 'Sig Collector Signup')
          shouldLog = (count ?? 0) === 0
        }
        if (shouldLog) {
          await supabase.from('interactions').insert({
            contact_id: contactId,
            interaction_type: 'Sig Collector Signup',
            direction: 'Inbound',
            interaction_date: (contactData.date_added as string) || new Date().toISOString().split('T')[0],
            summary: sourceForm !== 'Squarespace Contacts Export' ? `via ${sourceForm}` : 'Sig collector (from Squarespace)',
          })
        }
      }

      // Generate actions for new contacts only (if enabled)
      if (autoActions && row._action === 'create') {
        const dateAdded = contactData.date_added ? new Date(contactData.date_added as string) : null
        const now = new Date()
        const daysSince = dateAdded ? Math.floor((now.getTime() - dateAdded.getTime()) / 86400000) : null
        const year = dateAdded ? dateAdded.getFullYear() : null

        const priority = daysSince !== null && daysSince <= 7 ? 'High' : year && year >= 2026 ? 'Medium' : 'Low'
        const dueDays = daysSince !== null && daysSince <= 3 ? 0 : daysSince !== null && daysSince <= 7 ? 1 : year && year >= 2026 ? 3 : 7
        const dueDate = new Date(Date.now() + dueDays * 86400000).toISOString().split('T')[0]
        const isOld = !year || year < 2026

        const actions: { title: string; area: string; ask: string }[] = []

        if (contactData.is_volunteer) actions.push({
          title: isOld ? `Check in with ${firstName} about their interest` : `Welcome ${firstName} and ask how they can help`,
          area: 'Volunteers',
          ask: isOld
            ? `You expressed interest in the campaign last year. We are now collecting signatures and looking for active volunteers — would you still like to help?`
            : `Ask what kind of volunteering they're interested in and invite them to join Discord.`,
        })
        if (contactData.is_signature_collector) actions.push({
          title: isOld ? `Check in with ${firstName} about collecting signatures` : `Follow up with ${firstName} about collecting signatures`,
          area: 'Signature Collection',
          ask: isOld
            ? `You signed up to collect signatures last year. We still need collectors — can you collect 10 signatures this week?`
            : `Ask if they can collect 10 signatures this week and join Discord.`,
        })
        if (contactData.is_donor) actions.push({
          title: `Send thank-you to ${firstName}`,
          area: 'Donations',
          ask: `Thank them for their donation. Ask if they want to help beyond donating.`,
        })

        for (const action of actions) {
          await supabase.from('actions').insert({
            contact_id: contactId,
            action_area: action.area,
            action_type: 'Email',
            title: action.title,
            suggested_ask: action.ask,
            assigned_to: 'admin',
            priority,
            status: 'Not started',
            due_date: dueDate,
          })
        }
      }

      processed++
    }

    await supabase.from('imports').update({ status: 'processed', processed_count: processed }).eq('id', importRecord.id)
    setProcessedCount(processed)
    setStep('done')
    setLoading(false)
    router.refresh()
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <p className="text-green-600 font-medium">Import complete — {processedCount} contacts processed.</p>
          <p className="text-sm text-gray-500">Actions created for new volunteers, signature collectors, and donors.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={reset}>Import another file</Button>
            <Button onClick={() => router.push('/actions')}>View actions</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === 'review') {
    const creates = reviewRows.filter(r => r._action === 'create').length
    const merges = reviewRows.filter(r => r._action === 'merge').length
    const skips = reviewRows.filter(r => r._action === 'skip').length
    const firstNameCol = Object.entries(fieldMap).find(([, v]) => v === 'first_name')?.[0]
    const lastNameCol = Object.entries(fieldMap).find(([, v]) => v === 'last_name')?.[0]
    const emailCol = Object.entries(fieldMap).find(([, v]) => v === 'email')?.[0]

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review — {filename}</CardTitle>
          <p className="text-sm text-gray-500">{sourceForm}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 text-sm">
            <span className="text-green-600 font-medium">{creates} new</span>
            <span className="text-blue-600 font-medium">{merges} merge with existing</span>
            {skips > 0 && <span className="text-gray-400">{skips} skipped</span>}
          </div>
          <div className="max-h-96 overflow-y-auto border rounded divide-y text-sm">
            {reviewRows.map((row, idx) => {
              const name = [firstNameCol && row.data[firstNameCol], lastNameCol && row.data[lastNameCol]].filter(Boolean).join(' ')
              const email = emailCol ? row.data[emailCol] ?? '' : ''
              return (
                <div key={idx} className="px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-medium">{name || '(no name)'}</span>
                      <span className="text-gray-400 ml-2 text-xs">{email}</span>
                      {row._match && <span className="ml-2 text-xs text-blue-600">→ matches {row._match.full_name}</span>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {(['create', 'merge', 'skip'] as const).map(a => (
                        (!row._match && a === 'merge') ? null :
                        (row._match && a === 'create') ? null : (
                          <button key={a} onClick={() => setRowAction(idx, a)}
                            className={`text-xs px-2 py-0.5 rounded border ${row._action === a ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                            {a}
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                  {row.roles.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {row.roles.map(r => <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
            <Button onClick={handleProcess} disabled={loading}>
              {loading ? 'Processing…' : `Process ${creates + merges} contacts`}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === 'mapping') {
    const sampleRow = rows[0] ?? {}
    const mapped = headers.filter(h => fieldMap[h] !== 'ignore')
    const ignored = headers.filter(h => fieldMap[h] === 'ignore')

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Map Fields — {filename}</CardTitle>
          <p className="text-sm text-gray-500">
            {mapped.length} columns mapped, {ignored.length} ignored. Review and adjust before continuing.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 w-1/3">Your column</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 w-1/3">Sample value</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 w-1/3">Maps to</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {headers.map(header => (
                  <tr key={header} className={fieldMap[header] === 'ignore' ? 'opacity-40' : ''}>
                    <td className="px-3 py-2 font-medium text-gray-700">{header}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs truncate max-w-[200px]">
                      {sampleRow[header] || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={fieldMap[header] ?? 'ignore'}
                        onValueChange={(v) => setFieldMap(prev => ({ ...prev, [header]: v ?? 'ignore' }))}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CRM_FIELDS.map(f => (
                            <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
            <Button onClick={handlePreview} disabled={loading}>
              {loading ? 'Checking for duplicates…' : 'Preview contacts →'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload CSV</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>CSV File</Label>
          <div
            className="border-2 border-dashed border-gray-200 rounded-lg px-6 py-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {filename ? (
              <div>
                <p className="font-medium text-gray-900">{filename}</p>
                <p className="text-sm text-gray-500 mt-1">{rows.length} rows · {headers.length} columns</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Click to select a CSV file</p>
            )}
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Source</Label>
          <Select value={sourceForm} onValueChange={(v) => setSourceForm(v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="What is this CSV from?" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoActions}
            onChange={e => setAutoActions(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Auto-create pipeline actions for new contacts</span>
        </label>

        <Button
          onClick={() => setStep('mapping')}
          disabled={!rows.length || !sourceForm}
        >
          Map fields →
        </Button>
      </CardContent>
    </Card>
  )
}
