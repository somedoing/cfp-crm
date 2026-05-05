'use client'

import { useState, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
const CLOSED_STATUSES = ['Done', 'Committed', 'Declined', 'Unresponsive', 'Dropped', 'Skipped']
const OUTCOMES = ['Committed', 'Declined', 'Unresponsive', 'Done']

type ColKey = 'needs-review' | 'ready' | 'jon' | 'contacted' | 'followup' | 'positive' | 'closed'

const COLUMNS: {
  key: ColKey
  label: string
  color: string
  hoverColor: string
  statusSet: string | null
  assignedTo: string | null
}[] = [
  { key: 'needs-review', label: 'Needs Review',       color: 'bg-gray-100',    hoverColor: 'ring-gray-300',   statusSet: 'Needs Review',      assignedTo: 'admin'     },
  { key: 'ready',        label: 'Ready to Contact',   color: 'bg-blue-50',     hoverColor: 'ring-blue-300',   statusSet: 'Ready to Contact',  assignedTo: 'admin'     },
  { key: 'jon',          label: "Jon's Queue",         color: 'bg-purple-50',   hoverColor: 'ring-purple-300', statusSet: 'Assigned to Jon',   assignedTo: 'candidate' },
  { key: 'contacted',    label: 'Contacted, Waiting', color: 'bg-yellow-50',   hoverColor: 'ring-yellow-300', statusSet: 'Contacted',         assignedTo: 'admin'     },
  { key: 'followup',     label: 'Follow Up Needed',   color: 'bg-orange-50',   hoverColor: 'ring-orange-300', statusSet: 'Follow-up',         assignedTo: 'admin'     },
  { key: 'positive',     label: 'Positive Response',  color: 'bg-green-50',    hoverColor: 'ring-green-300',  statusSet: 'Positive Response', assignedTo: 'admin'     },
  { key: 'closed',       label: 'Closed',             color: 'bg-gray-50',     hoverColor: 'ring-gray-200',   statusSet: null,                assignedTo: null        },
]

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

function getColKey(action: Action): ColKey {
  const s = action.status
  if (CLOSED_STATUSES.includes(s)) return 'closed'
  if (s === 'Needs Review') return 'needs-review'
  if (s === 'Assigned to Jon') return 'jon'
  if (s === 'Contacted' || s === 'Waiting on response') return 'contacted'
  if (s === 'Follow-up') return 'followup'
  if (s === 'Positive Response' || s === 'Responded') return 'positive'
  return 'ready' // Not started, Ready to Contact, In progress
}

export default function ActionKanban({ initialActions }: { initialActions: Action[] }) {
  const supabase = createClient()
  const [actions, setActions] = useState<Action[]>(initialActions)
  const [closingId, setClosingId] = useState<string | null>(null)

  function patch(id: string, data: Partial<Action>) {
    setActions(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
  }

  const byColumn = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map(c => [c.key, [] as Action[]])) as Record<ColKey, Action[]>
    for (const a of actions) map[getColKey(a)].push(a)
    for (const col of COLUMNS) {
      if (col.key !== 'closed') {
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
    const updates: Record<string, string> = {
      status: col.statusSet,
      assigned_to: col.assignedTo ?? 'admin',
      updated_at: ts,
    }
    if (col.key === 'contacted' || col.key === 'followup') updates.sent_at = ts

    patch(actionId, updates as any)
    await supabase.from('actions').update(updates).eq('id', actionId)
  }

  async function closeAction(id: string, outcome: string) {
    const ts = new Date().toISOString()
    const updates = { status: outcome, updated_at: ts, completed_date: new Date().toISOString().split('T')[0] }
    patch(id, updates)
    await supabase.from('actions').update(updates).eq('id', id)
    setClosingId(null)
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
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
                          <div ref={provided.innerRef} {...provided.draggableProps}>
                            <ActionCard
                              action={action}
                              colKey={col.key}
                              dragHandleProps={provided.dragHandleProps ?? undefined}
                              isDragging={snapshot.isDragging}
                              isClosing={closingId === action.id}
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
  dragHandleProps,
  isDragging,
  isClosing,
  onClose,
  onStartClose,
  onCancelClose,
}: {
  action: Action
  colKey: ColKey
  dragHandleProps?: Record<string, any>
  isDragging: boolean
  isClosing: boolean
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
      {/* Header row: drag handle + priority + type */}
      <div className="flex items-start gap-1.5">
        {!isClosed && dragHandleProps && (
          <span
            {...dragHandleProps}
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing select-none pt-0.5 text-lg leading-none"
            title="Drag to move"
          >
            ⠿
          </span>
        )}
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
