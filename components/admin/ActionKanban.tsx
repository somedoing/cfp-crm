'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
const CLOSED_STATUSES = ['Done', 'Committed', 'Declined', 'Unresponsive', 'Dropped', 'Skipped']
const OUTCOMES = ['Committed', 'Declined', 'Unresponsive', 'Done']

type Action = {
  id: string
  title: string
  priority: string
  action_type: string
  action_area: string
  assigned_to: string
  status: string
  due_date: string | null
  sent_at: string | null
  updated_at: string
  contact: { id: string; full_name: string; email: string; date_added: string } | null
  org: { id: string; name: string; org_type: string } | null
}

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000)
}

export default function ActionKanban({ initialActions }: { initialActions: Action[] }) {
  const supabase = createClient()
  const [actions, setActions] = useState<Action[]>(initialActions)
  const [moving, setMoving] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  function patch(id: string, data: Partial<Action>) {
    setActions(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
  }

  const queue = actions
    .filter(a => !CLOSED_STATUSES.includes(a.status) && !a.sent_at && a.status !== 'Follow-up')
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))

  const contacted = actions
    .filter(a => !CLOSED_STATUSES.includes(a.status) && !!a.sent_at && a.status !== 'Follow-up')
    .sort((a, b) => new Date(a.sent_at!).getTime() - new Date(b.sent_at!).getTime())

  const followUp = actions
    .filter(a => a.status === 'Follow-up')
    .sort((a, b) => new Date(a.sent_at ?? a.updated_at).getTime() - new Date(b.sent_at ?? b.updated_at).getTime())

  const closed = actions
    .filter(a => CLOSED_STATUSES.includes(a.status))
    .slice(0, 25)

  async function markContacted(id: string) {
    setMoving(id)
    const ts = new Date().toISOString()
    await supabase.from('actions').update({ sent_at: ts, status: 'Contacted', updated_at: ts }).eq('id', id)
    patch(id, { sent_at: ts, status: 'Contacted', updated_at: ts })
    setMoving(null)
  }

  async function markFollowUp(id: string) {
    setMoving(id)
    const ts = new Date().toISOString()
    await supabase.from('actions').update({ status: 'Follow-up', sent_at: ts, updated_at: ts }).eq('id', id)
    patch(id, { status: 'Follow-up', sent_at: ts, updated_at: ts })
    setMoving(null)
  }

  async function closeAction(id: string, outcome: string) {
    setMoving(id)
    const ts = new Date().toISOString()
    await supabase.from('actions').update({ status: outcome, completed_date: today, updated_at: ts }).eq('id', id)
    patch(id, { status: outcome, updated_at: ts })
    setMoving(null)
    setClosingId(null)
  }

  async function sendToJon(id: string) {
    setMoving(id)
    const ts = new Date().toISOString()
    await supabase.from('actions').update({ assigned_to: 'candidate', updated_at: ts }).eq('id', id)
    patch(id, { assigned_to: 'candidate', updated_at: ts })
    setMoving(null)
  }

  async function sendToAdmin(id: string) {
    setMoving(id)
    const ts = new Date().toISOString()
    await supabase.from('actions').update({ assigned_to: 'admin', updated_at: ts }).eq('id', id)
    patch(id, { assigned_to: 'admin', updated_at: ts })
    setMoving(null)
  }

  const cols = [
    { key: 'queue', label: 'Queue', color: 'bg-gray-100', actions: queue },
    { key: 'contacted', label: 'Contacted', color: 'bg-blue-50', actions: contacted },
    { key: 'followup', label: 'Follow-up', color: 'bg-amber-50', actions: followUp },
    { key: 'closed', label: 'Closed', color: 'bg-green-50', actions: closed },
  ]

  return (
    <div className="flex gap-4 items-start overflow-x-auto pb-4">
      {cols.map(col => (
        <div key={col.key} className="flex-1 min-w-72">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">{col.label}</h2>
            <span className="text-gray-500 bg-gray-200 rounded-full px-2 py-0.5 text-sm">{col.actions.length}</span>
          </div>
          <div className={`${col.color} rounded-xl p-3 space-y-3 min-h-32`}>
            {col.actions.length === 0 && (
              <p className="text-gray-400 text-center py-8">Nothing here</p>
            )}
            {col.actions.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                column={col.key}
                moving={moving === action.id}
                isClosing={closingId === action.id}
                onMarkContacted={() => markContacted(action.id)}
                onMarkFollowUp={() => markFollowUp(action.id)}
                onClose={(outcome) => closeAction(action.id, outcome)}
                onSendToJon={() => sendToJon(action.id)}
                onSendToAdmin={() => sendToAdmin(action.id)}
                onStartClose={() => setClosingId(action.id)}
                onCancelClose={() => setClosingId(null)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ActionCard({
  action,
  column,
  moving,
  isClosing,
  onMarkContacted,
  onMarkFollowUp,
  onClose,
  onSendToJon,
  onSendToAdmin,
  onStartClose,
  onCancelClose,
}: {
  action: Action
  column: string
  moving: boolean
  isClosing: boolean
  onMarkContacted: () => void
  onMarkFollowUp: () => void
  onClose: (outcome: string) => void
  onSendToJon: () => void
  onSendToAdmin: () => void
  onStartClose: () => void
  onCancelClose: () => void
}) {
  const isClosed = column === 'closed'
  const staleDays = action.sent_at ? daysSince(action.sent_at) : null
  const isStale = column === 'contacted' && staleDays !== null && staleDays >= 5
  const isFollowUpStale = column === 'followup' && staleDays !== null && staleDays >= 3

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm space-y-2 ${moving ? 'opacity-50' : ''}`}>
      {/* Priority + type + stale */}
      <div className="flex items-center gap-2 flex-wrap">
        {action.priority === 'High' && <Badge variant="destructive">High</Badge>}
        {action.priority === 'Medium' && <Badge variant="default">Med</Badge>}
        {action.priority === 'Low' && <Badge variant="secondary">Low</Badge>}
        <span className="text-gray-400">{action.action_type}</span>
        {isStale && (
          <span className="ml-auto text-red-600 font-medium">{staleDays}d — no response</span>
        )}
        {isFollowUpStale && (
          <span className="ml-auto text-amber-600 font-medium">{staleDays}d — follow up again?</span>
        )}
        {column === 'contacted' && !isStale && staleDays !== null && (
          <span className="ml-auto text-gray-400">{staleDays}d ago</span>
        )}
        {isClosed && (
          <OutcomeBadge status={action.status} />
        )}
      </div>

      {/* Contact or Org */}
      {action.contact && (
        <div>
          <Link href={`/contacts/${action.contact.id}`} className="font-semibold text-gray-900 hover:text-blue-600">
            {action.contact.full_name}
          </Link>
          {action.contact.email && (
            <div className="text-gray-500">{action.contact.email}</div>
          )}
        </div>
      )}
      {!action.contact && action.org && (
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/organizations/${action.org.id}`} className="font-semibold text-gray-900 hover:text-blue-600">
            {action.org.name}
          </Link>
          {action.org.org_type && (
            <span className="text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 text-sm">{action.org.org_type}</span>
          )}
        </div>
      )}

      {/* Title */}
      <p className="text-gray-700">{action.title}</p>

      {/* Queue metadata */}
      {column === 'queue' && (
        <div className="flex gap-1 flex-wrap">
          {action.assigned_to === 'candidate' ? (
            <span className="text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 text-sm">Jon's queue</span>
          ) : (
            <span className="text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 text-sm">Admin review</span>
          )}
        </div>
      )}

      {/* Close outcome picker */}
      {isClosing && (
        <div className="pt-1 space-y-2">
          <p className="text-gray-600 font-medium">Outcome:</p>
          <div className="flex gap-2 flex-wrap">
            {OUTCOMES.map(o => (
              <button
                key={o}
                onClick={() => onClose(o)}
                disabled={moving}
                className="border border-gray-300 rounded px-2 py-1 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {o}
              </button>
            ))}
            <button onClick={onCancelClose} className="text-gray-400 hover:text-gray-600 px-2 py-1">Cancel</button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!isClosed && !isClosing && (
        <div className="flex gap-2 pt-1 flex-wrap">
          <Link
            href={`/actions/${action.id}`}
            className="text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-2 py-1 hover:border-gray-400 transition-colors"
          >
            Edit
          </Link>
          {column === 'queue' && (
            <>
              <button
                onClick={onMarkContacted}
                disabled={moving}
                className="bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Mark contacted
              </button>
              {action.assigned_to === 'admin' ? (
                <button
                  onClick={onSendToJon}
                  disabled={moving}
                  className="border border-gray-200 text-gray-600 rounded px-2 py-1 hover:border-gray-400 transition-colors disabled:opacity-50"
                >
                  → Jon
                </button>
              ) : (
                <button
                  onClick={onSendToAdmin}
                  disabled={moving}
                  className="border border-gray-200 text-gray-600 rounded px-2 py-1 hover:border-gray-400 transition-colors disabled:opacity-50"
                >
                  ← Back
                </button>
              )}
            </>
          )}
          {column === 'contacted' && (
            <button
              onClick={onMarkFollowUp}
              disabled={moving}
              className="border border-amber-300 text-amber-700 rounded px-2 py-1 hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              Follow up
            </button>
          )}
          <button
            onClick={onStartClose}
            disabled={moving}
            className="text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-2 py-1 hover:border-gray-400 transition-colors disabled:opacity-50 ml-auto"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}

function OutcomeBadge({ status }: { status: string }) {
  if (status === 'Committed') return <Badge className="ml-auto bg-green-600 text-white">Committed</Badge>
  if (status === 'Declined') return <Badge variant="secondary" className="ml-auto">Declined</Badge>
  if (status === 'Unresponsive') return <Badge variant="secondary" className="ml-auto text-gray-500">Unresponsive</Badge>
  if (status === 'Dropped' || status === 'Skipped') return <Badge variant="secondary" className="ml-auto text-gray-400">Skipped</Badge>
  return <Badge variant="secondary" className="ml-auto">Done</Badge>
}
