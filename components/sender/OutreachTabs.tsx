'use client'

import { useState } from 'react'
import OutreachCard from './OutreachCard'

type Tab = 'to-contact' | 'waiting' | 'follow-up'

export default function OutreachTabs({
  actions: initialActions,
  userId,
  today,
}: {
  actions: any[]
  userId: string
  today: string
}) {
  const [tab, setTab] = useState<Tab>('to-contact')
  const [actions, setActions] = useState(initialActions)

  function handleActionUpdate(id: string, updates: { status: string; due_date?: string | null }) {
    setActions(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  const active    = actions.filter(a => !['Done', 'Dropped', 'Skipped'].includes(a.status))
  const toContact = active
    .filter(a => a.status !== 'Waiting on response')
    .sort((a: any, b: any) => {
      const dateA = a.contact?.date_added ?? a.updated_at ?? ''
      const dateB = b.contact?.date_added ?? b.updated_at ?? ''
      return dateB.localeCompare(dateA)
    })
  const waiting   = active.filter(a => a.status === 'Waiting on response' && a.due_date && a.due_date > today)
  const followUp  = active.filter(a => a.status === 'Waiting on response' && (!a.due_date || a.due_date <= today))

  const current = tab === 'to-contact' ? toContact : tab === 'waiting' ? waiting : followUp

  const tabs = [
    {
      key: 'to-contact' as Tab,
      label: 'To Contact',
      count: toContact.length,
      empty: "No one left to contact — check back after the admin assigns new outreach.",
    },
    {
      key: 'waiting' as Tab,
      label: 'Contacted & Waiting',
      count: waiting.length,
      empty: "No one is waiting on a response right now.",
    },
    {
      key: 'follow-up' as Tab,
      label: 'Follow-Up',
      count: followUp.length,
      empty: "No follow-ups due yet.",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                tab === t.key
                  ? 'bg-blue-100 text-blue-600'
                  : t.key === 'follow-up'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab description */}
      {tab === 'waiting' && waiting.length > 0 && (
        <p className="text-xs text-gray-400">
          These people have been contacted and are within the response window. They'll move to Follow-Up automatically if no response is logged.
        </p>
      )}
      {tab === 'follow-up' && followUp.length > 0 && (
        <p className="text-xs text-amber-600">
          These people haven't responded after {followUp.length === 1 ? '3–5 days' : '3–5 days each'}. Time to follow up.
        </p>
      )}

      {/* Cards */}
      {current.length > 0 ? (
        <div className="space-y-3">
          {current.map((action: any) => (
            <OutreachCard
              key={action.id}
              action={action}
              userId={userId}
              today={today}
              onActionUpdate={handleActionUpdate}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-14">
          <p className="text-gray-400 text-sm">{tabs.find(t => t.key === tab)?.empty}</p>
        </div>
      )}
    </div>
  )
}
