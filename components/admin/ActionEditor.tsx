'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const PRIORITIES = ['High', 'Medium', 'Low']
const ACTION_TYPES = ['Call', 'Text', 'Email', 'Discord DM', 'Ask', 'Follow-up', 'Thank-you', 'Invite', 'Assign task', 'Check in', 'Pitch', 'Schedule meeting']
const ACTION_AREAS = ['Volunteers', 'Signature Collection', 'Discord', 'Donations', 'Media', 'Organization Outreach', 'Candidate Partners', 'Events', 'General Supporter Follow-Up']
const STATUSES = ['Not started', 'In progress', 'Contacted', 'Waiting on response', 'Responded', 'Done', 'Blocked', 'Dropped', 'Skipped']

export default function ActionEditor({ action }: { action: any }) {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState(action.title ?? '')
  const [suggestedAsk, setSuggestedAsk] = useState(action.suggested_ask ?? '')
  const [suggestedMessage, setSuggestedMessage] = useState(action.suggested_message ?? '')
  const [priority, setPriority] = useState(action.priority ?? 'Medium')
  const [actionType, setActionType] = useState(action.action_type ?? 'Email')
  const [actionArea, setActionArea] = useState(action.action_area ?? 'Volunteers')
  const [assignedTo, setAssignedTo] = useState(action.assigned_to ?? 'admin')
  const [status, setStatus] = useState(action.status ?? 'Not started')
  const [dueDate, setDueDate] = useState(action.due_date ?? '')
  const [notes, setNotes] = useState(action.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const contact = action.contact

  async function handleSave() {
    setSaving(true)
    await supabase.from('actions').update({
      title,
      suggested_ask: suggestedAsk,
      suggested_message: suggestedMessage,
      priority,
      action_type: actionType,
      action_area: actionArea,
      assigned_to: assignedTo,
      status,
      due_date: dueDate || null,
      notes,
      updated_at: new Date().toISOString(),
    }).eq('id', action.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleAssignToCandidate() {
    setSaving(true)
    await supabase.from('actions').update({
      assigned_to: 'candidate',
      updated_at: new Date().toISOString(),
    }).eq('id', action.id)
    setAssignedTo('candidate')
    setSaving(false)
  }

  async function handleMarkDone() {
    setSaving(true)
    await supabase.from('actions').update({
      status: 'Done',
      completed_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }).eq('id', action.id)
    router.push('/actions')
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/actions" className="text-sm text-gray-500 hover:text-gray-900">← Actions</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-700 truncate">{title}</span>
      </div>

      {/* Contact context */}
      {contact && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/contacts/${contact.id}`} className="font-semibold text-blue-600 hover:underline">
                    {contact.full_name}
                  </Link>
                  <span className="text-xs text-gray-400">{contact.display_id}</span>
                </div>
                <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                  {contact.email && <div>{contact.email}</div>}
                  {contact.phone && <div>{contact.phone}</div>}
                  {contact.town && <div>{contact.town}{contact.state ? `, ${contact.state}` : ''}</div>}
                </div>
              </div>
              <div className="text-right shrink-0 space-y-1">
                {contact.date_added && (
                  <div className="text-xs text-gray-500">Signed up {contact.date_added}</div>
                )}
                {contact.volunteer_stage && (
                  <Badge variant="secondary" className="text-xs">Vol: {contact.volunteer_stage}</Badge>
                )}
                {contact.donor_stage && (
                  <Badge variant="secondary" className="text-xs">Donor: {contact.donor_stage}</Badge>
                )}
              </div>
            </div>
            {contact.last_contact_summary && (
              <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                <span className="font-medium">Last contact:</span> {contact.last_contact_summary}
              </div>
            )}
            {contact.notes && (
              <div className="mt-2 text-xs text-gray-500">
                <span className="font-medium">Notes:</span> {contact.notes}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action editor */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Edit Action</CardTitle>
            <div className="flex gap-2">
              {assignedTo !== 'candidate' && (
                <Button size="sm" onClick={handleAssignToCandidate} disabled={saving}>
                  Send to Jon's queue →
                </Button>
              )}
              {assignedTo === 'candidate' && (
                <Badge variant="default" className="text-xs px-3 py-1">In Jon's queue</Badge>
              )}
              <Button size="sm" variant="outline" onClick={handleMarkDone} disabled={saving}>
                Mark done
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Suggested ask</Label>
            <Textarea
              value={suggestedAsk}
              onChange={e => setSuggestedAsk(e.target.value)}
              className="resize-none h-20 text-sm"
              placeholder="What should Jon ask this person to do?"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Suggested message <span className="text-gray-400">(what Jon should actually say)</span></Label>
            <Textarea
              value={suggestedMessage}
              onChange={e => setSuggestedMessage(e.target.value)}
              className="resize-none h-28 text-sm"
              placeholder={`Hi ${contact?.full_name?.split(' ')[0] ?? 'there'},\n\n...`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v ?? priority)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={actionType} onValueChange={v => setActionType(v ?? actionType)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{ACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Area</Label>
              <Select value={actionArea} onValueChange={v => setActionArea(v ?? actionArea)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{ACTION_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={v => setStatus(v ?? status)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Due date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Assigned to</Label>
              <Select value={assignedTo} onValueChange={v => setAssignedTo(v ?? assignedTo)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="candidate">Candidate (Jon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Admin notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="resize-none h-16 text-sm"
              placeholder="Internal notes — not shown to Jon"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {saved && <span className="text-sm text-green-600">Saved</span>}
            <Link href="/actions" className="text-sm text-gray-500 hover:text-gray-900 ml-auto">
              Back to actions
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
