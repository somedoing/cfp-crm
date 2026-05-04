'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

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

type ParsedRow = Record<string, string>
type DupeMatch = { contact_id: string; full_name: string; email: string; confidence: string }
type ReviewRow = { data: ParsedRow; _action: 'create' | 'merge' | 'skip'; _match?: DupeMatch; roles: string[] }

// Proper CSV parser that handles quoted fields containing commas and newlines
function parseCSV(text: string): ParsedRow[] {
  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        current.push(field.trim())
        field = ''
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++
        current.push(field.trim())
        if (current.some(f => f !== '')) rows.push(current)
        current = []
        field = ''
      } else {
        field += ch
      }
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

function normalizeEmail(email: string) {
  return email?.toLowerCase().trim() ?? ''
}

// Parse Squarespace Mailing Lists field into role flags
function parseMailingLists(mailingLists: string): Record<string, unknown> {
  const lists = mailingLists.split(',').map(l => l.trim().toLowerCase())
  const flags: Record<string, unknown> = {}

  if (lists.some(l => l.includes('volunteer'))) {
    flags.is_volunteer = true
    flags.is_supporter = true
    flags.volunteer_stage = 'New'
  }
  if (lists.some(l => l.includes('newsletter') || l.includes('campaign newsletter'))) {
    flags.newsletter_subscriber = true
    flags.email_opt_in = true
    flags.is_supporter = true
  }
  if (lists.some(l => l.includes('media'))) {
    flags.is_media_contact = true
  }
  if (lists.some(l => l.includes('donor'))) {
    flags.is_donor = true
  }
  if (lists.some(l => l.includes('signature') || l.includes('petition'))) {
    flags.is_signature_collector = true
    flags.signature_stage = 'New lead'
  }
  if (lists.some(l => l.includes('coalition'))) {
    flags.is_coalition_contact = true
  }
  if (lists.some(l => l.includes('partner'))) {
    flags.is_candidate_partner = true
  }
  if (lists.some(l => l.includes('discord'))) {
    flags.in_discord = true
  }
  if (lists.some(l => l.includes('supporter'))) {
    flags.is_supporter = true
  }

  return flags
}

function getRoleLabels(mailingLists: string): string[] {
  if (!mailingLists) return []
  return mailingLists.split(',').map(l => l.trim()).filter(Boolean)
}

// Map a Squarespace contacts export row to CRM contact fields
function mapSquarespaceRow(row: ParsedRow): Record<string, unknown> {
  const mailingFlags = parseMailingLists(row['Mailing Lists'] ?? '')
  const donationCount = parseInt(row['Donation Count'] ?? '0') || 0
  const donationAmount = parseFloat(row['Total Donation Amount'] ?? '0') || 0
  const acceptsMarketing = row['Accepts Marketing']?.toUpperCase() === 'TRUE'

  const mapped: Record<string, unknown> = {
    first_name: row['First Name'] ?? '',
    last_name: row['Last Name'] ?? '',
    email: normalizeEmail(row['Email'] ?? '') || null,
    phone: row['Shipping Phone Number'] || row['Billing Phone Number'] || null,
    town: row['Shipping City'] || row['Billing City'] || null,
    state: row['Shipping Province/State'] || row['Billing Province/State'] || null,
    zip: row['Shipping Zip'] || row['Billing Zip'] || null,
    email_opt_in: acceptsMarketing,
    source: 'Squarespace',
    original_source_form: 'Squarespace Contacts Export',
    updated_at: new Date().toISOString(),
    ...mailingFlags,
  }

  if (donationCount > 0 || donationAmount > 0) {
    mapped.is_donor = true
    mapped.donor_stage = 'Donated'
    mapped.is_supporter = true
  }

  if (acceptsMarketing) {
    mapped.newsletter_subscriber = true
  }

  return mapped
}

// Map a standard form row to CRM contact fields
function mapFormRow(row: ParsedRow, sourceForm: string): Record<string, unknown> {
  const mapped: Record<string, unknown> = {
    first_name: row['First Name'] || row['first_name'] || row['First'] || '',
    last_name: row['Last Name'] || row['last_name'] || row['Last'] || '',
    email: normalizeEmail(row['Email'] || row['email'] || '') || null,
    phone: row['Phone'] || row['phone'] || row['Phone Number'] || null,
    town: row['City'] || row['Town'] || row['city'] || row['town'] || null,
    state: row['State'] || row['Province'] || null,
    zip: row['Zip'] || row['ZIP'] || row['Postal Code'] || null,
    source: sourceForm,
    original_source_form: sourceForm,
    updated_at: new Date().toISOString(),
  }

  if (sourceForm === 'Volunteer Interest Form') {
    mapped.is_volunteer = true
    mapped.is_supporter = true
    mapped.volunteer_stage = 'New'
  } else if (sourceForm === 'Signature Collector Signup') {
    mapped.is_volunteer = true
    mapped.is_signature_collector = true
    mapped.is_supporter = true
    mapped.signature_stage = 'New lead'
  } else if (sourceForm === 'Newsletter Signup') {
    mapped.newsletter_subscriber = true
    mapped.email_opt_in = true
    mapped.is_supporter = true
  } else if (sourceForm === 'Donation Form') {
    mapped.is_donor = true
    mapped.donor_stage = 'Donated'
  } else if (sourceForm === 'Pledge Form') {
    mapped.is_supporter = true
    mapped.is_volunteer = true
    mapped.volunteer_stage = 'New'
  }

  return mapped
}

export default function ImportUploader() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [sourceForm, setSourceForm] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([])
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload')
  const [loading, setLoading] = useState(false)
  const [filename, setFilename] = useState('')
  const [processedCount, setProcessedCount] = useState(0)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    const text = await file.text()
    const parsed = parseCSV(text)
    setRows(parsed)

    // Auto-detect Squarespace contacts export
    if (parsed[0] && 'Mailing Lists' in parsed[0]) {
      setSourceForm('Squarespace Contacts Export')
    }
  }

  async function handlePreview() {
    if (!rows.length || !sourceForm) return
    setLoading(true)

    const emails = rows.map(r => normalizeEmail(r['Email'] || r['email'] || '')).filter(Boolean)

    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('id, full_name, email, phone')
      .in('email', emails)

    const emailMap = new Map((existingContacts ?? []).map(c => [normalizeEmail(c.email), c]))

    const reviewed: ReviewRow[] = rows.map(row => {
      const email = normalizeEmail(row['Email'] || row['email'] || '')
      const match = emailMap.get(email)
      const roles = getRoleLabels(row['Mailing Lists'] ?? '')
      if (match) {
        return { data: row, _action: 'merge', _match: { contact_id: match.id, full_name: match.full_name, email: match.email, confidence: 'exact' }, roles }
      }
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
      .select()
      .single()

    if (!importRecord) { setLoading(false); return }

    for (const row of reviewRows) {
      if (row._action === 'skip') continue

      const contactData = sourceForm === 'Squarespace Contacts Export'
        ? mapSquarespaceRow(row.data)
        : mapFormRow(row.data, sourceForm)

      const firstName = row.data['First Name'] || row.data['first_name'] || ''

      let contactId: string

      if (row._action === 'merge' && row._match) {
        await supabase.from('contacts').update(contactData).eq('id', row._match.contact_id)
        contactId = row._match.contact_id
      } else {
        const { data: newContact } = await supabase
          .from('contacts')
          .insert(contactData)
          .select('id')
          .single()
        if (!newContact) continue
        contactId = newContact.id
      }

      // Generate actions based on roles
      const actions: { title: string; area: string; ask: string }[] = []

      if (contactData.is_volunteer && !row._match) {
        actions.push({
          title: `Welcome ${firstName} and ask how they can help`,
          area: 'Volunteers',
          ask: "Ask what kind of volunteering they're interested in and invite them to join Discord.",
        })
      }
      if (contactData.is_signature_collector && !row._match) {
        actions.push({
          title: `Follow up with ${firstName} about collecting signatures`,
          area: 'Signature Collection',
          ask: 'Ask if they can collect 10 signatures this week and join Discord.',
        })
      }
      if (contactData.is_donor && !row._match) {
        actions.push({
          title: `Send thank-you to ${firstName}`,
          area: 'Donations',
          ask: 'Thank them for their donation. Ask if they want to help beyond donating.',
        })
      }

      for (const action of actions) {
        await supabase.from('actions').insert({
          contact_id: contactId,
          action_area: action.area,
          action_type: 'Email',
          title: action.title,
          suggested_ask: action.ask,
          assigned_to: 'admin',
          priority: 'Medium',
          status: 'Not started',
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        })
      }

      processed++
    }

    await supabase.from('imports').update({ status: 'processed', processed_count: processed }).eq('id', importRecord.id)

    setProcessedCount(processed)
    setStep('done')
    setLoading(false)
    router.refresh()
  }

  function reset() {
    setStep('upload')
    setRows([])
    setReviewRows([])
    setFilename('')
    setSourceForm('')
    setProcessedCount(0)
  }

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

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review Import — {filename}</CardTitle>
          <p className="text-sm text-gray-500">{sourceForm}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 text-sm">
            <span className="text-green-600 font-medium">{creates} new contacts</span>
            <span className="text-blue-600 font-medium">{merges} merge with existing</span>
            {skips > 0 && <span className="text-gray-400">{skips} skipped</span>}
          </div>

          <div className="max-h-96 overflow-y-auto border rounded divide-y text-sm">
            {reviewRows.map((row, idx) => {
              const name = [row.data['First Name'] || row.data['first_name'], row.data['Last Name'] || row.data['last_name']].filter(Boolean).join(' ')
              const email = row.data['Email'] || row.data['email'] || ''
              return (
                <div key={idx} className="px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-medium">{name || '(no name)'}</span>
                      <span className="text-gray-400 ml-2 text-xs">{email}</span>
                      {row._match && (
                        <span className="ml-2 text-xs text-blue-600">
                          → matches {row._match.full_name}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {(['create', 'merge', 'skip'] as const).map(a => (
                        (!row._match && a === 'merge') ? null :
                        (row._match && a === 'create') ? null : (
                          <button
                            key={a}
                            onClick={() => setRowAction(idx, a)}
                            className={`text-xs px-2 py-0.5 rounded border ${row._action === a ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 border-gray-200 hover:border-gray-400'}`}
                          >
                            {a}
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                  {row.roles.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {row.roles.map(r => (
                        <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
            <Button onClick={handleProcess} disabled={loading}>
              {loading ? 'Processing…' : `Process ${creates + merges} contacts`}
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
                <p className="text-sm text-gray-500 mt-1">{rows.length} rows found</p>
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
          {sourceForm === 'Squarespace Contacts Export' && (
            <p className="text-xs text-gray-500">
              Will auto-map Mailing Lists → role flags, Shipping fields → address, Donation Count → donor status.
            </p>
          )}
        </div>

        <Button onClick={handlePreview} disabled={!rows.length || !sourceForm || loading}>
          {loading ? 'Checking for duplicates…' : 'Preview import'}
        </Button>
      </CardContent>
    </Card>
  )
}
