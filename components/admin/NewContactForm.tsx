'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

const VOLUNTEER_STAGES = ['New','Contacted','Interested','Asked','Assigned','Active','Reliable','Lead','Paused','Inactive','Not a fit']
const PRIORITIES = ['High', 'Medium', 'Low']
const SOURCES = ['Website', 'Canvassing', 'Phone bank', 'Event', 'Referral', 'Social media', 'Email', 'Walk-in', 'Other']

export default function NewContactForm() {
  const router = useRouter()
  const supabase = createClient()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [town, setTown] = useState('')
  const [state, setState] = useState('NH')
  const [zip, setZip] = useState('')
  const [source, setSource] = useState('')
  const [priority, setPriority] = useState('')
  const [isVolunteer, setIsVolunteer] = useState(false)
  const [isDonor, setIsDonor] = useState(false)
  const [isSig, setIsSig] = useState(false)
  const [isPress, setIsPress] = useState(false)
  const [isAlly, setIsAlly] = useState(false)
  const [volunteerStage, setVolunteerStage] = useState('New')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSave = firstName.trim() || lastName.trim() || email.trim()

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError('')

    const today = new Date().toISOString().split('T')[0]

    const { data, error: err } = await supabase
      .from('contacts')
      .insert({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        town: town.trim() || null,
        state: state.trim() || null,
        zip: zip.trim() || null,
        source: source || null,
        priority: priority || null,
        is_volunteer: isVolunteer,
        is_donor: isDonor,
        is_signature_collector: isSig,
        is_press_contact: isPress,
        is_media_contact: isPress,
        is_candidate_partner: isAlly,
        volunteer_stage: isVolunteer ? volunteerStage : null,
        notes: notes.trim() || null,
        date_added: today,
      })
      .select('id')
      .single()

    if (err || !data) {
      setError(err?.message ?? 'Failed to save')
      setSaving(false)
      return
    }

    router.push(`/contacts/${data.id}`)
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/contacts" className="text-gray-500 hover:text-gray-900 text-sm">
        ← Contacts
      </Link>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>New contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>First name</Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First" autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Last name</Label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last" />
            </div>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(603) 555-0100" />
            </div>
            <div className="space-y-1">
              <Label>Town</Label>
              <Input value={town} onChange={e => setTown(e.target.value)} placeholder="e.g. Concord" />
            </div>
            <div className="flex gap-2">
              <div className="space-y-1 w-20">
                <Label>State</Label>
                <Input value={state} onChange={e => setState(e.target.value)} placeholder="NH" />
              </div>
              <div className="space-y-1 flex-1">
                <Label>Zip</Label>
                <Input value={zip} onChange={e => setZip(e.target.value)} placeholder="03301" />
              </div>
            </div>
          </div>

          {/* Source + priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Source</Label>
              <Select value={source} onValueChange={v => v && setSource(v)}>
                <SelectTrigger><SelectValue placeholder="How did they find us?" /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={v => v && setPriority(v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Role flags */}
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-4">
              {[
                { label: 'Volunteer', val: isVolunteer, set: setIsVolunteer },
                { label: 'Donor', val: isDonor, set: setIsDonor },
                { label: 'Sig collector', val: isSig, set: setIsSig },
                { label: 'Press / media', val: isPress, set: setIsPress },
                { label: 'Political ally', val: isAlly, set: setIsAlly },
              ].map(({ label, val, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={e => set(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Volunteer stage (only when volunteer checked) */}
          {isVolunteer && (
            <div className="space-y-1">
              <Label>Volunteer stage</Label>
              <Select value={volunteerStage} onValueChange={v => v && setVolunteerStage(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOLUNTEER_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any context about this person…"
              className="resize-none h-20"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? 'Saving…' : 'Create contact'}
            </Button>
            <Link href="/contacts" className="text-gray-500 hover:text-gray-900 ml-auto">
              Cancel
            </Link>
          </div>
          {!canSave && (
            <p className="text-gray-400 text-sm">Enter at least a name or email to save.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
