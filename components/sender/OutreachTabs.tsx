'use client'

import { useState } from 'react'
import OutreachCard from './OutreachCard'

type Tab = 'to-contact' | 'waiting' | 'follow-up'
type ContactFilter = 'volunteer' | 'donor' | 'signature'

const CONTACT_FILTERS: { key: ContactFilter; label: string }[] = [
  { key: 'volunteer',  label: 'Volunteers' },
  { key: 'donor',      label: 'Donors' },
  { key: 'signature',  label: 'Sig Collectors' },
]

function matchesFilter(action: any, filters: Set<ContactFilter>) {
  if (filters.size === 0) return true
  const c = action.contact
  if (!c) return false
  if (filters.has('volunteer') && c.is_volunteer) return true
  if (filters.has('donor') && c.is_donor) return true
  if (filters.has('signature') && c.is_signature_collector) return true
  return false
}

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
  const [activeFilters, setActiveFilters] = useState<Set<ContactFilter>>(new Set())

  function toggleFilter(key: ContactFilter) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function handleActionUpdate(id: string, updates: { status: string; due_date?: string | null }) {
    setActions(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  const CLOSED = ['Done', 'Committed', 'Declined', 'Unresponsive', 'Dropped', 'Skipped']
  const NON_QUEUE = [...CLOSED, 'Needs Review', 'Contacted', 'Waiting on response',
    'Follow-up', 'Positive Response', 'Responded', 'Supporter', 'Active', 'Core']

  const toContact = actions
    .filter(a => !NON_QUEUE.includes(a.status) && matchesFilter(a, activeFilters))
    .sort((a: any, b: any) => {
      if (a.sort_order != null && b.sort_order != null) return a.sort_order - b.sort_order
      if (a.sort_order != null) return -1
      if (b.sort_order != null) return 1
      const dateA = a.contact?.date_added ?? ''
      const dateB = b.contact?.date_added ?? ''
      const dateCmp = dateB.localeCompare(dateA)
      if (dateCmp !== 0) return dateCmp
      const idA = a.contact?.display_id ?? ''
      const idB = b.contact?.display_id ?? ''
      return idB.localeCompare(idA)
    })

  const waiting = actions.filter(a =>
    matchesFilter(a, activeFilters) &&
    (a.status === 'Contacted' || a.status === 'Waiting on response') &&
    a.due_date && a.due_date > today
  )

  const followUp = actions.filter(a =>
    matchesFilter(a, activeFilters) && (
      a.status === 'Follow-up' ||
      ((a.status === 'Contacted' || a.status === 'Waiting on response') && (!a.due_date || a.due_date <= today))
    )
  )

  const current = tab === 'to-contact' ? toContact : tab === 'waiting' ? waiting : followUp

  const tabs = [
    { key: 'to-contact' as Tab, label: 'To Contact',        count: toContact.length, empty: "No one left to contact — check back after the admin assigns new outreach." },
    { key: 'waiting'    as Tab, label: 'Contacted & Waiting', count: waiting.length,  empty: "No one is waiting on a response right now." },
    { key: 'follow-up'  as Tab, label: 'Follow-Up',          count: followUp.length,  empty: "No follow-ups due yet." },
  ]

  return (
    <div className="space-y-4">
      {/* Contact type filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 font-medium">Show:</span>
        {CONTACT_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => toggleFilter(f.key)}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
              activeFilters.has(f.key)
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {f.label}
          </button>
        ))}
        {activeFilters.size > 0 && (
          <button
            onClick={() => setActiveFilters(new Set())}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear
          </button>
        )}
      </div>

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
