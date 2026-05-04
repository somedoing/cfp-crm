'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 }

type Action = {
  id: string
  title: string
  suggested_ask: string
  priority: string
  action_type: string
  action_area: string
  assigned_to: string
  status: string
  due_date: string
  contact: { id: string; full_name: string; email: string; date_added: string } | null
}

type Column = {
  key: string
  label: string
  color: string
  actions: Action[]
}

export default function ActionKanban({ initialActions }: { initialActions: Action[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [actions, setActions] = useState<Action[]>(initialActions)
  const [moving, setMoving] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const toReview = actions
    .filter(a => a.assigned_to === 'admin' && !['Done', 'Dropped', 'Skipped'].includes(a.status))
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))

  const jonQueue = actions
    .filter(a => a.assigned_to === 'candidate' && !['Done', 'Dropped', 'Skipped'].includes(a.status))
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))

  const done = actions
    .filter(a => ['Done', 'Dropped', 'Skipped'].includes(a.status))
    .slice(0, 20)

  const columns: Column[] = [
    { key: 'review', label: 'To Review', color: 'bg-gray-100', actions: toReview },
    { key: 'candidate', label: "Jon's Queue", color: 'bg-blue-50', actions: jonQueue },
    { key: 'done', label: 'Done', color: 'bg-green-50', actions: done },
  ]

  async function sendToJon(actionId: string) {
    setMoving(actionId)
    await supabase.from('actions').update({ assigned_to: 'candidate', updated_at: new Date().toISOString() }).eq('id', actionId)
    setActions(prev => prev.map(a => a.id === actionId ? { ...a, assigned_to: 'candidate' } : a))
    setMoving(null)
  }

  async function sendToAdmin(actionId: string) {
    setMoving(actionId)
    await supabase.from('actions').update({ assigned_to: 'admin', updated_at: new Date().toISOString() }).eq('id', actionId)
    setActions(prev => prev.map(a => a.id === actionId ? { ...a, assigned_to: 'admin' } : a))
    setMoving(null)
  }

  async function markDone(actionId: string) {
    setMoving(actionId)
    await supabase.from('actions').update({
      status: 'Done',
      completed_date: today,
      updated_at: new Date().toISOString(),
    }).eq('id', actionId)
    setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: 'Done' } : a))
    setMoving(null)
  }

  return (
    <div className="flex gap-4 items-start overflow-x-auto pb-4">
      {columns.map(col => (
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
                today={today}
                moving={moving === action.id}
                onSendToJon={() => sendToJon(action.id)}
                onSendToAdmin={() => sendToAdmin(action.id)}
                onMarkDone={() => markDone(action.id)}
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
  today,
  moving,
  onSendToJon,
  onSendToAdmin,
  onMarkDone,
}: {
  action: Action
  column: string
  today: string
  moving: boolean
  onSendToJon: () => void
  onSendToAdmin: () => void
  onMarkDone: () => void
}) {
  const isOverdue = action.due_date && action.due_date < today
  const isDone = column === 'done'

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm space-y-2 ${moving ? 'opacity-50' : ''}`}>
      {/* Priority + type */}
      <div className="flex items-center gap-2">
        {action.priority === 'High' && <Badge variant="destructive">High</Badge>}
        {action.priority === 'Medium' && <Badge variant="default">Med</Badge>}
        {action.priority === 'Low' && <Badge variant="secondary">Low</Badge>}
        <span className="text-gray-400">{action.action_type}</span>
        {isOverdue && !isDone && (
          <span className="text-red-600 font-medium ml-auto">Overdue</span>
        )}
        {action.due_date && !isOverdue && !isDone && (
          <span className="text-gray-400 ml-auto">{action.due_date}</span>
        )}
      </div>

      {/* Contact */}
      {action.contact && (
        <div>
          <Link href={`/contacts/${action.contact.id}`} className="font-semibold text-gray-900 hover:text-blue-600">
            {action.contact.full_name}
          </Link>
          {action.contact.date_added && (
            <span className="text-gray-400 ml-2">since {action.contact.date_added}</span>
          )}
          {action.contact.email && (
            <div className="text-gray-500">{action.contact.email}</div>
          )}
        </div>
      )}

      {/* Title */}
      <p className="text-gray-700">{action.title}</p>

      {/* Actions */}
      {!isDone && (
        <div className="flex gap-2 pt-1 flex-wrap">
          <Link
            href={`/actions/${action.id}`}
            className="text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-2 py-1 hover:border-gray-400 transition-colors"
          >
            Edit
          </Link>
          {column === 'review' && (
            <button
              onClick={onSendToJon}
              disabled={moving}
              className="bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              → Jon's queue
            </button>
          )}
          {column === 'candidate' && (
            <button
              onClick={onSendToAdmin}
              disabled={moving}
              className="border border-gray-200 text-gray-600 rounded px-2 py-1 hover:border-gray-400 transition-colors disabled:opacity-50"
            >
              ← Back to review
            </button>
          )}
          <button
            onClick={onMarkDone}
            disabled={moving}
            className="text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-2 py-1 hover:border-gray-400 transition-colors disabled:opacity-50 ml-auto"
          >
            Done ✓
          </button>
        </div>
      )}
    </div>
  )
}
