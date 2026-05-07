'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'

const CLOSED_STATUSES = ['Done', 'Committed', 'Declined', 'Unresponsive', 'Dropped', 'Skipped']
const OUTCOMES = ['Committed', 'Declined', 'Unresponsive', 'Done', 'Dropped', 'Skipped']
const STATUSES = ['Needs Review', 'To Contact', 'Contacted', 'Follow-up', 'Positive Response']

type Action = {
  id: string
  title: string
  priority: string
  action_type: string
  action_area: string
  status: string
  due_date: string | null
  suggested_ask: string | null
  suggested_message: string | null
  notes: string | null
  contact_id: string | null
  contact: { id: string; full_name: string; email: string | null; phone: string | null; notes: string | null; last_contact_summary: string | null } | null
  org: { id: string; name: string } | null
}

export default function MyPipeline({ initialActions }: { initialActions: Action[] }) {
  const supabase = createClient()
  const [actions, setActions] = useState(initialActions)

  function removeAction(id: string) {
    setActions(prev => prev.filter(a => a.id !== id))
  }

  if (actions.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Nothing assigned to you right now.</p>
        <p className="text-gray-400 text-sm mt-1">Actions assigned to you from the org pipeline will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        <strong>{actions.length}</strong> {actions.length === 1 ? 'action' : 'actions'} assigned to you
      </p>
      {actions.map(action => (
        <ActionRow
          key={action.id}
          action={action}
          onClose={() => removeAction(action.id)}
        />
      ))}
    </div>
  )
}

function ActionRow({ action, onClose }: { action: Action; onClose: () => void }) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(action.status)
  const [outcome, setOutcome] = useState('')
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState(false)
  const [followUpDate, setFollowUpDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isOverdue = action.due_date && action.due_date < new Date().toISOString().split('T')[0]
  const subject = action.contact?.full_name ?? action.org?.name ?? 'Unknown'
  const subjectHref = action.contact ? `/contacts/${action.contact.id}` : action.org ? `/organizations/${action.org.id}` : null

  async function handleSave() {
    setSaving(true)

    const updates: Record<string, any> = {
      status,
      outcome: outcome || null,
      follow_up_needed: followUp,
      follow_up_date: followUpDate || null,
    }
    if (CLOSED_STATUSES.includes(status)) {
      updates.completed_date = new Date().toISOString().split('T')[0]
    }

    await supabase.from('actions').update(updates).eq('id', action.id)

    if (notes.trim() && action.contact_id) {
      await supabase.from('interactions').insert({
        contact_id: action.contact_id,
        action_id: action.id,
        interaction_date: new Date().toISOString().split('T')[0],
        interaction_type: action.action_type === 'Call' ? 'Call' : action.action_type === 'Text' ? 'Text' : 'Email',
        direction: 'Outbound',
        owner: 'admin',
        summary: notes,
        result: outcome || null,
        follow_up_needed: followUp,
        follow_up_date: followUpDate || null,
      })
    }

    if (followUp && followUpDate && action.contact_id) {
      await supabase.from('actions').insert({
        contact_id: action.contact_id,
        action_area: action.action_area,
        action_type: 'Follow-up',
        title: `Follow up with ${subject}`,
        assigned_to: 'admin',
        priority: action.priority,
        status: 'To Contact',
        due_date: followUpDate,
      })
    }

    if (outcome === 'Do not contact' && action.contact_id) {
      await supabase.from('contacts').update({ do_not_contact: true }).eq('id', action.contact_id)
    }

    setSaving(false)
    setSaved(true)
    setExpanded(false)
    if (CLOSED_STATUSES.includes(status)) onClose()
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 space-y-3 ${saved ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {action.priority === 'High' && <Badge variant="destructive">High</Badge>}
            {action.priority === 'Medium' && <Badge>Med</Badge>}
            {action.priority === 'Low' && <Badge variant="secondary">Low</Badge>}
            <Badge variant="outline">{action.action_type}</Badge>
            {isOverdue && <span className="text-red-500 text-xs font-medium">Overdue</span>}
            {action.due_date && !isOverdue && (
              <span className="text-gray-400 text-xs">Due {action.due_date}</span>
            )}
          </div>
          <div>
            {subjectHref ? (
              <Link href={subjectHref} className="font-semibold text-gray-900 hover:text-blue-600">
                {subject}
              </Link>
            ) : (
              <span className="font-semibold text-gray-900">{subject}</span>
            )}
            {action.contact?.email && (
              <a href={`mailto:${action.contact.email}`} className="block text-sm text-blue-600 hover:underline">
                {action.contact.email}
              </a>
            )}
            {action.contact?.phone && (
              <a href={`tel:${action.contact.phone}`} className="block text-sm text-gray-500">
                {action.contact.phone}
              </a>
            )}
          </div>
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

      {/* Context */}
      {action.suggested_ask && (
        <div className="bg-blue-50 rounded-md px-3 py-2">
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-0.5">Suggested ask</p>
          <p className="text-sm text-blue-900">{action.suggested_ask}</p>
        </div>
      )}
      {action.suggested_message && (
        <div className="bg-gray-50 rounded-md px-3 py-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Message</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{action.suggested_message}</p>
        </div>
      )}
      {action.contact?.last_contact_summary && (
        <p className="text-xs text-gray-500">
          <span className="font-medium">Last contact:</span> {action.contact.last_contact_summary}
        </p>
      )}
      {action.contact?.notes && (
        <p className="text-xs text-gray-500">
          <span className="font-medium">Notes:</span> {action.contact.notes}
        </p>
      )}

      {/* Log result form */}
      {expanded && (
        <div className="border-t pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">Status</label>
              <Select value={status} onValueChange={v => v && setStatus(v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  {OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">Outcome</label>
              <Select value={outcome} onValueChange={v => setOutcome(v ?? '')}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {['Committed', 'Declined', 'No response', 'Needs more info', 'Wrong contact', 'Do not contact'].map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">Notes</label>
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
              Schedule follow-up
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
    </div>
  )
}
