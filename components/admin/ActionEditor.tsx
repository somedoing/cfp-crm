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
const ACTION_TYPES = ['Call', 'Text', 'Email', 'Discord DM', 'Follow-up', 'Thank-you', 'Invite', 'Check in', 'Pitch', 'Schedule meeting']
const ACTION_AREAS = ['Volunteers', 'Signature Collection', 'Discord', 'Donations', 'Media', 'Organization Outreach', 'Candidate Partners', 'Events', 'General Supporter Follow-Up']
const STATUSES = ['Needs Review', 'To Contact', 'Contacted', 'Follow-up', 'Positive Response', 'Committed', 'Declined', 'Unresponsive', 'Done', 'Dropped', 'Skipped']

export default function ActionEditor({ action }: { action: any }) {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState(action.title ?? '')
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
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/actions" className="text-gray-500 hover:text-gray-900">← Back to board</Link>
      </div>

      {contact && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link href={`/contacts/${contact.id}`} className="font-semibold text-blue-600 hover:underline text-lg">
                  {contact.full_name}
                </Link>
                <div className="text-gray-600 mt-1 space-y-0.5">
                  {contact.email && <div>{contact.email}</div>}
                  {contact.phone && <div>{contact.phone}</div>}
                  {contact.town && <div>{contact.town}{contact.state ? `, ${contact.state}` : ''}</div>}
                </div>
              </div>
              <div className="text-right shrink-0 space-y-1">
                {contact.date_added && <div className="text-gray-500">Signed up {contact.date_added}</div>}
                <div className="flex gap-1 justify-end flex-wrap">
                  {contact.volunteer_stage && <Badge variant="secondary">Vol: {contact.volunteer_stage}</Badge>}
                  {contact.donor_stage && <Badge variant="secondary">Donor: {contact.donor_stage}</Badge>}
                </div>
              </div>
            </div>
            {contact.notes && (
              <div className="mt-3 pt-3 border-t text-gray-500">
                <span className="font-medium">Notes:</span> {contact.notes}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Edit Action</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleMarkDone} disabled={saving}>
                Mark done ✓
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v ?? priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={actionType} onValueChange={v => setActionType(v ?? actionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Area</Label>
              <Select value={actionArea} onValueChange={v => setActionArea(v ?? actionArea)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTION_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={v => setStatus(v ?? status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Assigned to</Label>
              <Select value={assignedTo} onValueChange={v => setAssignedTo(v ?? assignedTo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="sender">Sender</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="resize-none h-24"
              placeholder="Any context or notes about this action..."
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {saved && <span className="text-green-600">Saved</span>}
            <Link href="/actions" className="text-gray-500 hover:text-gray-900 ml-auto">
              Cancel
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
