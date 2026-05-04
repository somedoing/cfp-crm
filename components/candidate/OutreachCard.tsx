'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Action } from '@/types'

type Props = {
  action: Action & { contact: { full_name: string; display_id: string; email: string; phone: string; last_contact_summary: string; notes: string } }
}

const OUTCOMES = ['Yes', 'Maybe', 'No', 'No response', 'Needs more info', 'Wrong contact', 'Do not contact']
const STATUSES = ['Not started', 'Contacted', 'Waiting on response', 'Responded', 'Done', 'Skip']

export default function OutreachCard({ action }: Props) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(action.status)
  const [outcome, setOutcome] = useState(action.outcome ?? '')
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState(false)
  const [followUpDate, setFollowUpDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)

    await supabase.from('actions').update({
      status,
      outcome: outcome || null,
      follow_up_needed: followUp,
      follow_up_date: followUpDate || null,
      completed_date: ['Done', 'Skip'].includes(status) ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', action.id)

    if (notes.trim()) {
      await supabase.from('interactions').insert({
        contact_id: action.contact_id,
        action_id: action.id,
        interaction_date: new Date().toISOString().split('T')[0],
        interaction_type: action.action_type === 'Call' ? 'Call' : action.action_type === 'Text' ? 'Text' : 'Email',
        direction: 'Outbound',
        owner: 'candidate',
        summary: notes,
        result: outcome || null,
        follow_up_needed: followUp,
        follow_up_date: followUpDate || null,
      })
    }

    if (followUp && followUpDate) {
      await supabase.from('actions').insert({
        contact_id: action.contact_id,
        action_area: action.action_area,
        action_type: 'Follow-up',
        title: `Follow up with ${action.contact.full_name}`,
        assigned_to: 'candidate',
        priority: action.priority,
        status: 'Not started',
        due_date: followUpDate,
      })
    }

    if (outcome === 'Do not contact') {
      await supabase.from('contacts').update({ do_not_contact: true }).eq('id', action.contact_id)
    }

    setSaving(false)
    setSaved(true)
    setExpanded(false)
  }

  const priorityColor = action.priority === 'High' ? 'destructive' : action.priority === 'Medium' ? 'default' : 'secondary'

  return (
    <Card className={saved ? 'opacity-50' : ''}>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{action.contact.full_name}</span>
              <Badge variant={priorityColor as any}>{action.priority}</Badge>
              <Badge variant="outline">{action.action_type}</Badge>
            </div>
            {action.contact.email && (
              <a href={`mailto:${action.contact.email}`} className="text-sm text-blue-600 hover:underline block mt-0.5">
                {action.contact.email}
              </a>
            )}
            {action.contact.phone && (
              <a href={`tel:${action.contact.phone}`} className="text-sm text-gray-500 block">
                {action.contact.phone}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saved && <span className="text-xs text-green-600 font-medium">Logged</span>}
            {!saved && (
              <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Collapse' : 'Log result'}
              </Button>
            )}
          </div>
        </div>

        {action.suggested_ask && (
          <div className="bg-blue-50 rounded-md px-3 py-2">
            <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-0.5">Suggested ask</p>
            <p className="text-sm text-blue-900">{action.suggested_ask}</p>
          </div>
        )}

        {action.suggested_message && (
          <div className="bg-gray-50 rounded-md px-3 py-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Suggested message</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{action.suggested_message}</p>
          </div>
        )}

        {action.contact.last_contact_summary && (
          <p className="text-xs text-gray-500">
            <span className="font-medium">Last contact:</span> {action.contact.last_contact_summary}
          </p>
        )}

        {action.notes && (
          <p className="text-xs text-gray-500">
            <span className="font-medium">Note from admin:</span> {action.notes}
          </p>
        )}

        {expanded && (
          <div className="border-t pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? status)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Outcome</Label>
                <Select value={outcome} onValueChange={(v) => setOutcome(v ?? '')}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What happened? What did they say?"
                className="text-sm h-20 resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={followUp}
                  onChange={e => setFollowUp(e.target.checked)}
                  className="rounded"
                />
                Follow-up needed
              </label>
              {followUp && (
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="text-sm border rounded px-2 py-1"
                />
              )}
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
