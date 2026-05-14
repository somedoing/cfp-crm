'use client'

import { useState, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
const CLOSED_STATUSES = ['Done', 'Committed', 'Declined', 'Unresponsive', 'Dropped', 'Skipped']
const ENGAGEMENT_STATUSES = ['Supporter', 'Active', 'Core']
const OUTCOMES = ['Committed', 'Declined', 'Unresponsive', 'Done']

type ColKey = 'needs-review' | 'queued' | 'contacted' | 'followup' | 'positive' | 'supporter' | 'active' | 'core' | 'closed'

const COLUMNS: {
  key: ColKey
  label: string
  color: string
  hoverColor: string
  statusSet: string | null
  assignedTo: string | null
}[] = [
  { key: 'needs-review', label: 'Needs Review',       color: 'bg-gray-100',    hoverColor: 'ring-gray-300',   statusSet: 'Needs Review',  assignedTo: 'admin'     },
  { key: 'queued',       label: 'To Contact',         color: 'bg-blue-50',     hoverColor: 'ring-blue-300',   statusSet: 'To Contact',    assignedTo: 'sender' },
  { key: 'contacted',    label: 'Contacted, Waiting', color: 'bg-yellow-50',   hoverColor: 'ring-yellow-300', statusSet: 'Contacted',     assignedTo: 'admin'     },
  { key: 'followup',     label: 'Follow Up Needed',   color: 'bg-orange-50',   hoverColor: 'ring-orange-300', statusSet: 'Follow-up',     assignedTo: 'admin'     },
  { key: 'positive',     label: 'Positive Response',  color: 'bg-green-50',    hoverColor: 'ring-green-300',  statusSet: 'Positive Response', assignedTo: 'admin' },
  { key: 'supporter',    label: 'Supporter',          color: 'bg-teal-50',     hoverColor: 'ring-teal-300',   statusSet: 'Supporter',     assignedTo: 'admin'     },
  { key: 'active',       label: 'Active',             color: 'bg-indigo-50',   hoverColor: 'ring-indigo-300', statusSet: 'Active',        assignedTo: 'admin'     },
  { key: 'core',         label: 'Core',               color: 'bg-amber-50',    hoverColor: 'ring-amber-300',  statusSet: 'Core',          assignedTo: 'admin'     },
  { key: 'closed',       label: 'Closed',             color: 'bg-gray-50',     hoverColor: 'ring-gray-200',   statusSet: null,            assignedTo: null        },
]

type User = { id: string; full_name: string }

type Action = {
  id: string
  title: string
  priority: string
  action_type: string
  action_area: string
  assigned_to: string
  assigned_user_id: string | null
  status: string
  due_date: string | null
  sent_at: string | null
  updated_at: string
  contact: { id: string; full_name: string; email: string; date_added: string } | null
  org: { id: string; name: string; org_type: string } | null
}

function getColKey(action: Action): ColKey {
  const s = action.status
  const today = new Date().toISOString().split('T')[0]
  if (CLOSED_STATUSES.includes(s)) return 'closed'
  if (s === 'Needs Review') return 'needs-review'
  if (s === 'To Contact' || s === 'Ready to Contact' || s === 'Waiting to contact' || s === 'Assigned to Jon') return 'queued'
  if (s === 'Contacted' || s === 'Waiting on response') {
    if (action.due_date && action.due_date <= today) return 'followup'
    return 'contacted'
  }
  if (s === 'Follow-up') return 'followup'
  if (s === 'Positive Response' || s === 'Responded') return 'positive'
  if (s === 'Supporter') return 'supporter'
  if (s === 'Active') return 'active'
  if (s === 'Core') return 'core'
  return 'queued'
}

export default function ActionKanban({
  initialActions,
  users,
}: {
  initialActions: Action[]
  users: User[]
}) {
  const supabase = createClient()
  const [actions, setActions] = useState<Action[]>(initialActions)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  function patch(id: string, data: Partial<Action>) {
    setActions(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
  }

  const byColumn = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map(c => [c.key, [] as Action[]])) as Record<ColKey, Action[]>
    for (const a of actions) map[getColKey(a)].push(a)
    for (const col of COLUMNS) {
      if (col.key === 'queued') {
        // Newest contact first so fresh leads are at the top
        map[col.key].sort((a, b) => {
          const dateA = a.contact?.date_added ?? a.updated_at ?? ''
          const dateB = b.contact?.date_added ?? b.updated_at ?? ''
          return dateB.localeCompare(dateA)
        })
      } else if (col.key !== 'closed') {
        map[col.key].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
      }
    }
    return map
  }, [actions])

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const { draggableId: actionId, source, destination } = result
    if (source.droppableId === destination.droppableId) return

    const col = COLUMNS.find(c => c.key === destination.droppableId)
    if (!col?.statusSet) return

    const ts = new Date().toISOString()
    const updates: Record<string, any> = {
      status: col.statusSet,
      assigned_to: col.assignedTo ?? 'admin',
      updated_at: ts,
    }
    if (col.key === 'contacted' || col.key === 'followup') updates.sent_at = ts
    if (col.key === 'contacted') {
      const d = new Date()
      d.setDate(d.getDate() + 5)
      updates.due_date = d.toISOString().split('T')[0]
    }
    // When moving OUT of the queued column, clear the assigned user
    if (col.key !== 'queued') updates.assigned_user_id = null

    patch(actionId, updates as any)
    await supabase.from('actions').update(updates).eq('id', actionId)
  }

  async function assignUser(actionId: string, userId: string | null) {
    patch(actionId, { assigned_user_id: userId })
    await supabase.from('actions').update({ assigned_user_id: userId }).eq('id', actionId)
  }

  async function clearPipeline() {
    setClearing(true)
    await supabase
      .from('actions')
      .delete()
      .not('status', 'in', '("Done","Committed","Declined","Unresponsive","Dropped","Skipped","Supporter","Active","Core")')
    setActions(prev => prev.filter(a => CLOSED_STATUSES.includes(a.status) || ENGAGEMENT_STATUSES.includes(a.status)))
    setConfirmClear(false)
    setClearing(false)
  }

  async function closeAction(id: string, outcome: string) {
    const ts = new Date().toISOString()
    const updates = { status: outcome, updated_at: ts, completed_date: new Date().toISOString().split('T')[0] }
    patch(id, updates)
    await supabase.from('actions').update(updates).eq('id', id)
    setClosingId(null)
  }

  const openCount = actions.filter(a => !CLOSED_STATUSES.includes(a.status) && !ENGAGEMENT_STATUSES.includes(a.status)).length

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {openCount > 0 && (
        <div className="flex items-center justify-end mb-3">
          {confirmClear ? (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-red-700 text-sm">
                Clear all {openCount} open actions? This cannot be undone.
              </span>
              <button
                onClick={clearPipeline}
                disabled={clearing}
                className="bg-red-600 text-white rounded px-3 py-1 text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {clearing ? 'Clearing…' : 'Yes, clear all'}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-gray-400 hover:text-red-500 text-sm border border-gray-200 hover:border-red-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              Clear pipeline ({openCount})
            </button>
          )}
        </div>
      )}
      <div className="flex gap-3 items-start overflow-x-auto pb-4">
        {COLUMNS.map(col => {
          const colActions = byColumn[col.key]
          return (
            <div key={col.key} className="flex-none w-56">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-800">{col.label}</h2>
                <span className="text-gray-500 bg-gray-200 rounded-full px-2 py-0.5 text-sm">{colActions.length}</span>
              </div>
              <Droppable droppableId={col.key} isDropDisabled={col.key === 'closed'}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`${col.color} rounded-xl p-2 space-y-2 min-h-24 transition-all ${snapshot.isDraggingOver ? `ring-2 ${col.hoverColor}` : ''}`}
                  >
                    {colActions.length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-gray-400 text-center py-6 text-sm">Empty</p>
                    )}
                    {colActions.map((action, index) => (
                      <Draggable
                        key={action.id}
                        draggableId={action.id}
                        index={index}
                        isDragDisabled={col.key === 'closed'}
                      >
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                            <ActionCard
                              action={action}
                              colKey={col.key}
                              isDragging={snapshot.isDragging}
                              isClosing={closingId === action.id}
                              users={col.key === 'queued' ? users : []}
                              onAssign={userId => assignUser(action.id, userId)}
                              onClose={outcome => closeAction(action.id, outcome)}
                              onStartClose={() => setClosingId(action.id)}
                              onCancelClose={() => setClosingId(null)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}

function ActionCard({
  action,
  colKey,
  isDragging,
  isClosing,
  users,
  onAssign,
  onClose,
  onStartClose,
  onCancelClose,
}: {
  action: Action
  colKey: ColKey
  isDragging: boolean
  isClosing: boolean
  users: User[]
  onAssign: (userId: string | null) => void
  onClose: (outcome: string) => void
  onStartClose: () => void
  onCancelClose: () => void
}) {
  const isClosed = colKey === 'closed'
  const staleDays = action.sent_at
    ? Math.floor((Date.now() - new Date(action.sent_at).getTime()) / 86400000)
    : null
  const isStale =
    (colKey === 'contacted' && staleDays !== null && staleDays >= 5) ||
    (colKey === 'followup' && staleDays !== null && staleDays >= 3)

  return (
    <div className={`bg-white rounded-lg border p-2.5 shadow-sm space-y-1.5 ${isDragging ? 'shadow-xl rotate-1 border-blue-200' : 'border-gray-200'}`}>
      {/* Header row: priority + type */}
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {action.priority === 'High' && <Badge variant="destructive">High</Badge>}
            {action.priority === 'Medium' && <Badge>Med</Badge>}
            {action.priority === 'Low' && <Badge variant="secondary">Low</Badge>}
            <span className="text-gray-400 text-sm">{action.action_type}</span>
            {isStale && (
              <span className="ml-auto text-red-500 font-medium text-sm">{staleDays}d stale</span>
            )}
            {colKey === 'contacted' && !isStale && staleDays !== null && (
              <span className="ml-auto text-gray-400 text-sm">{staleDays}d</span>
            )}
            {isClosed && <OutcomeBadge status={action.status} />}
          </div>

          {/* Contact or Org */}
          {action.contact && (
            <div>
              <Link
                href={`/contacts/${action.contact.id}`}
                className="font-medium text-gray-900 hover:text-blue-600 text-sm"
                onClick={e => e.stopPropagation()}
              >
                {action.contact.full_name}
              </Link>
              {action.contact.email && (
                <div className="text-gray-500 text-sm truncate">{action.contact.email}</div>
              )}
            </div>
          )}
          {!action.contact && action.org && (
            <div>
              <Link
                href={`/organizations/${action.org.id}`}
                className="font-medium text-gray-900 hover:text-blue-600 text-sm"
                onClick={e => e.stopPropagation()}
              >
                {action.org.name}
              </Link>
              {action.org.org_type && (
                <div className="text-gray-500 text-sm">{action.org.org_type}</div>
              )}
            </div>
          )}

          {/* Title */}
          {action.title && (
            <p className="text-gray-600 text-sm">{action.title}</p>
          )}
        </div>
      </div>

      {/* Assign to user — shown only in the "Waiting to contact" column */}
      {colKey === 'queued' && users.length > 0 && (
        <div className="border-t pt-1.5">
          <select
            value={action.assigned_user_id ?? ''}
            onChange={e => onAssign(e.target.value || null)}
            onClick={e => e.stopPropagation()}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            <option value="">— Unassigned —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Outcome picker */}
      {isClosing && (
        <div className="border-t pt-1.5 space-y-1.5">
          <p className="text-gray-600 text-sm font-medium">Outcome:</p>
          <div className="flex gap-1.5 flex-wrap">
            {OUTCOMES.map(o => (
              <button
                key={o}
                onClick={() => onClose(o)}
                className="border border-gray-300 rounded px-2 py-0.5 text-sm hover:bg-gray-50 transition-colors"
              >
                {o}
              </button>
            ))}
            <button onClick={onCancelClose} className="text-gray-400 hover:text-gray-600 text-sm px-1">✕</button>
          </div>
        </div>
      )}

      {/* Footer buttons */}
      {!isClosed && !isClosing && (
        <div className="flex items-center gap-2 border-t pt-1.5">
          <Link
            href={`/actions/${action.id}`}
            className="text-gray-400 hover:text-gray-700 text-sm"
            onClick={e => e.stopPropagation()}
          >
            Edit
          </Link>
          <button
            onClick={onStartClose}
            className="text-gray-400 hover:text-gray-700 text-sm ml-auto"
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
  if (status === 'Unresponsive') return <Badge variant="secondary" className="ml-auto text-gray-500">No response</Badge>
  if (status === 'Dropped' || status === 'Skipped') return <Badge variant="secondary" className="ml-auto text-gray-400">Skipped</Badge>
  return <Badge variant="secondary" className="ml-auto">Done</Badge>
}
