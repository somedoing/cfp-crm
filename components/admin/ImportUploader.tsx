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
type ReviewRow = { data: ParsedRow; _action: 'create' | 'merge' | 'skip'; _match?: DupeMatch }

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

function normalizeEmail(email: string) {
  return email?.toLowerCase().trim() ?? ''
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

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    const text = await file.text()
    const parsed = parseCSV(text)
    setRows(parsed)
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
      if (match) {
        return { data: row, _action: 'merge', _match: { contact_id: match.id, full_name: match.full_name, email: match.email, confidence: 'exact' } }
      }
      return { data: row, _action: 'create' }
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

    const { data: importRecord } = await supabase
      .from('imports')
      .insert({ filename, source_form: sourceForm, row_count: rows.length, status: 'reviewing' })
      .select()
      .single()

    if (!importRecord) { setLoading(false); return }

    let processed = 0

    for (const row of reviewRows) {
      if (row._action === 'skip') continue

      const firstName = row.data['First Name'] || row.data['first_name'] || row.data['First'] || ''
      const lastName = row.data['Last Name'] || row.data['last_name'] || row.data['Last'] || ''
      const email = normalizeEmail(row.data['Email'] || row.data['email'] || '')
      const phone = row.data['Phone'] || row.data['phone'] || ''
      const town = row.data['City'] || row.data['Town'] || row.data['city'] || row.data['town'] || ''

      const contactData: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName,
        email: email || null,
        phone: phone || null,
        town: town || null,
        source: sourceForm,
        original_source_form: sourceForm,
        updated_at: new Date().toISOString(),
      }

      // Apply role flags based on source form
      if (sourceForm === 'Volunteer Interest Form') {
        contactData.is_volunteer = true
        contactData.is_supporter = true
        contactData.volunteer_stage = 'New'
      } else if (sourceForm === 'Signature Collector Signup') {
        contactData.is_volunteer = true
        contactData.is_signature_collector = true
        contactData.is_supporter = true
        contactData.signature_stage = 'New lead'
      } else if (sourceForm === 'Newsletter Signup') {
        contactData.newsletter_subscriber = true
        contactData.email_opt_in = true
        contactData.is_supporter = true
      } else if (sourceForm === 'Donation Form') {
        contactData.is_donor = true
        contactData.donor_stage = 'Donated'
      } else if (sourceForm === 'Pledge Form') {
        contactData.is_supporter = true
        contactData.is_volunteer = true
        contactData.volunteer_stage = 'New'
      }

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

      // Generate suggested action
      let actionTitle = ''
      let suggestedAsk = ''

      if (sourceForm === 'Volunteer Interest Form') {
        actionTitle = `Welcome ${firstName} and ask how they can help`
        suggestedAsk = 'Ask what kind of volunteering they\'re interested in and invite them to join Discord.'
      } else if (sourceForm === 'Signature Collector Signup') {
        actionTitle = `Follow up with ${firstName} about collecting signatures`
        suggestedAsk = 'Ask if they can collect 10 signatures this week and join Discord.'
      } else if (sourceForm === 'Donation Form') {
        actionTitle = `Send thank-you to ${firstName}`
        suggestedAsk = 'Thank them for their donation. If not yet a volunteer, ask if they want to help beyond donating.'
      } else if (sourceForm === 'Pledge Form') {
        actionTitle = `Follow up with ${firstName} on their pledge`
        suggestedAsk = 'Check in on their interest in volunteering and next steps.'
      }

      if (actionTitle) {
        await supabase.from('actions').insert({
          contact_id: contactId,
          action_area: sourceForm.includes('Signature') ? 'Signature Collection' : sourceForm.includes('Donation') ? 'Donations' : 'Volunteers',
          action_type: 'Email',
          title: actionTitle,
          suggested_ask: suggestedAsk,
          assigned_to: 'admin',
          priority: 'Medium',
          status: 'Not started',
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        })
      }

      processed++
    }

    await supabase.from('imports').update({ status: 'processed', processed_count: processed }).eq('id', importRecord.id)

    setStep('done')
    setLoading(false)
    router.refresh()
  }

  if (step === 'done') {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <p className="text-green-600 font-medium">Import complete.</p>
          <p className="text-sm text-gray-500">Contacts updated and actions created.</p>
          <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); setReviewRows([]); setFilename(''); setSourceForm('') }}>
            Import another file
          </Button>
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
          <div className="flex gap-3 text-sm">
            <span className="text-green-600 font-medium">{creates} new</span>
            <span className="text-blue-600 font-medium">{merges} merge</span>
            <span className="text-gray-400">{skips} skip</span>
          </div>

          <div className="max-h-96 overflow-y-auto border rounded divide-y text-sm">
            {reviewRows.map((row, idx) => {
              const name = [row.data['First Name'] || row.data['first_name'], row.data['Last Name'] || row.data['last_name']].filter(Boolean).join(' ')
              const email = row.data['Email'] || row.data['email'] || ''
              return (
                <div key={idx} className="flex items-center justify-between px-3 py-2 gap-3">
                  <div className="min-w-0">
                    <span className="font-medium">{name || '(no name)'}</span>
                    <span className="text-gray-400 ml-2 text-xs">{email}</span>
                    {row._match && (
                      <span className="ml-2 text-xs text-blue-600">
                        → matches {row._match.full_name} ({row._match.confidence})
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
        <CardTitle className="text-base">Upload CSV from Squarespace</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Source Form</Label>
          <Select value={sourceForm} onValueChange={(v) => setSourceForm(v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="What form is this export from?" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

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

        <Button onClick={handlePreview} disabled={!rows.length || !sourceForm || loading}>
          {loading ? 'Checking for duplicates…' : 'Preview import'}
        </Button>
      </CardContent>
    </Card>
  )
}
