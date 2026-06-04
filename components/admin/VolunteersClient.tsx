'use client'

import React, { useState, useMemo, useDeferredValue } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ─── Constants ────────────────────────────────────────────────────────────────

const VOLUNTEER_STAGES = [
  'New', 'Contacted', 'Interested', 'Asked', 'Assigned',
  'Active', 'Reliable', 'Lead', 'Paused', 'Inactive', 'Not a fit',
]

const STAGE_COLORS: Record<string, string> = {
  'New':        'bg-amber-50 text-amber-800 border-amber-300',
  'Contacted':  'bg-blue-50 text-blue-700 border-blue-300',
  'Interested': 'bg-indigo-50 text-indigo-700 border-indigo-300',
  'Asked':      'bg-purple-50 text-purple-700 border-purple-300',
  'Assigned':   'bg-teal-50 text-teal-700 border-teal-300',
  'Active':     'bg-green-50 text-green-700 border-green-300',
  'Reliable':   'bg-green-100 text-green-800 border-green-400',
  'Lead':       'bg-green-200 text-green-900 border-green-500',
  'Paused':     'bg-gray-100 text-gray-500 border-gray-300',
  'Inactive':   'bg-gray-50 text-gray-400 border-gray-200',
  'Not a fit':  'bg-red-50 text-red-400 border-red-200',
}

const NEXT_STAGE: Record<string, string> = {
  'New':        'Contacted',
  'Contacted':  'Interested',
  'Interested': 'Asked',
  'Asked':      'Assigned',
  'Assigned':   'Active',
  'Active':     'Reliable',
  'Reliable':   'Lead',
}

const FILTER_GROUPS = [
  { key: 'all',           label: 'All' },
  { key: 'needs_contact', label: 'Needs contact',     stages: ['New'] as string[] },
  { key: 'following_up',  label: 'Following up',      stages: ['Contacted', 'Interested', 'Asked'] as string[] },
  { key: 'active',        label: 'Active',            stages: ['Assigned', 'Active', 'Reliable', 'Lead'] as string[] },
  { key: 'inactive',      label: 'Paused / Inactive', stages: ['Paused', 'Inactive', 'Not a fit'] as string[] },
]

const INTERACTION_TYPES = ['Email', 'Call', 'Text', 'Meeting', 'Discord', 'In-person']

// ─── Types ────────────────────────────────────────────────────────────────────

type Volunteer = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  town: string | null
  state: string | null
  volunteer_stage: string | null
  is_active_volunteer: boolean
  is_signature_collector: boolean
  last_contact_date: string | null
  last_contact_summary: string | null
  notes: string | null
  date_added: string | null
  priority: string | null
}

type LogForm = {
  type: string
  summary: string
  advanceStage: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)   return `${days}d ago`
  if (days < 30)  return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function rowUrgencyClass(stage: string | null, lastContact: string | null): string {
  if (!stage || stage === 'New') return 'bg-amber-50'
  if (['Contacted', 'Interested'].includes(stage) && lastContact) {
    const days = Math.floor((Date.now() - new Date(lastContact).getTime()) / 86400000)
    if (days > 14) return 'bg-orange-50'
  }
  return ''
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VolunteersClient({ volunteers: initial }: { volunteers: Volunteer[] }) {
  const supabase = createClient()

  const [volunteers, setVolunteers] = useState(initial)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [groupFilter, setGroupFilter] = useState('all')
  const [townFilter, setTownFilter] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [logForms, setLogForms] = useState<Record<string, LogForm>>({})
  const [savingLog, setSavingLog] = useState<string | null>(null)
  const [savingStage, setSavingStage] = useState<string | null>(null)

  // ─── Derived data ──────────────────────────────────────────────────────────

  const towns = useMemo(() => {
    const t = new Set(volunteers.map(v => v.town).filter(Boolean) as string[])
    return [...t].sort()
  }, [volunteers])

  const stats = useMemo(() => ({
    total:        volunteers.length,
    needsContact: volunteers.filter(v => !v.volunteer_stage || v.volunteer_stage === 'New').length,
    followingUp:  volunteers.filter(v => ['Contacted', 'Interested', 'Asked'].includes(v.volunteer_stage ?? '')).length,
    active:       volunteers.filter(v => ['Assigned', 'Active', 'Reliable', 'Lead'].includes(v.volunteer_stage ?? '')).length,
    inactive:     volunteers.filter(v => ['Paused', 'Inactive', 'Not a fit'].includes(v.volunteer_stage ?? '')).length,
  }), [volunteers])

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    let result = volunteers

    const group = FILTER_GROUPS.find(g => g.key === groupFilter)
    if (group && 'stages' in group) {
      const stages = (group as { stages: string[] }).stages
      result = result.filter(v => stages.includes(v.volunteer_stage ?? 'New'))
    }
    if (townFilter) result = result.filter(v => v.town === townFilter)
    if (q) result = result.filter(v => {
      const name = v.full_name || [v.first_name, v.last_name].filter(Boolean).join(' ')
      return (
        name.toLowerCase().includes(q) ||
        v.email?.toLowerCase().includes(q) ||
        v.town?.toLowerCase().includes(q) ||
        v.phone?.includes(q) ||
        v.notes?.toLowerCase().includes(q)
      )
    })

    const stageOrder = VOLUNTEER_STAGES
    return [...result].sort((a, b) => {
      const ai = stageOrder.indexOf(a.volunteer_stage ?? 'New')
      const bi = stageOrder.indexOf(b.volunteer_stage ?? 'New')
      if (ai !== bi) return ai - bi
      if (!a.last_contact_date && b.last_contact_date) return -1
      if (a.last_contact_date && !b.last_contact_date) return 1
      return (a.date_added ?? '') < (b.date_added ?? '') ? -1 : 1
    })
  }, [volunteers, deferredSearch, groupFilter, townFilter])

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function handleStageChange(id: string, stage: string) {
    setSavingStage(id)
    setVolunteers(prev => prev.map(v => v.id === id ? { ...v, volunteer_stage: stage } : v))
    await supabase.from('contacts').update({
      volunteer_stage: stage,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSavingStage(null)
  }

  function getForm(id: string): LogForm {
    return logForms[id] ?? { type: 'Email', summary: '', advanceStage: true }
  }

  function setFormField(id: string, field: keyof LogForm, value: string | boolean) {
    setLogForms(prev => ({ ...prev, [id]: { ...getForm(id), [field]: value } }))
  }

  async function submitLog(v: Volunteer) {
    const form = getForm(v.id)
    if (!form.summary.trim()) return
    setSavingLog(v.id)

    const today = new Date().toISOString().split('T')[0]
    const nextStage = NEXT_STAGE[v.volunteer_stage ?? 'New']

    await supabase.from('interactions').insert({
      contact_id: v.id,
      interaction_type: form.type,
      direction: 'Outbound',
      interaction_date: today,
      summary: form.summary.trim(),
    })

    const updates: Record<string, string> = {
      last_contact_date: today,
      last_contact_summary: form.summary.trim(),
      updated_at: new Date().toISOString(),
    }
    if (form.advanceStage && nextStage) updates.volunteer_stage = nextStage

    await supabase.from('contacts').update(updates).eq('id', v.id)

    setVolunteers(prev => prev.map(c => c.id === v.id ? {
      ...c,
      last_contact_date: today,
      last_contact_summary: form.summary.trim(),
      volunteer_stage: (form.advanceStage && nextStage) ? nextStage : c.volunteer_stage,
    } : c))

    setLogForms(prev => ({ ...prev, [v.id]: { type: 'Email', summary: '', advanceStage: true } }))
    setSavingLog(null)
  }

  function toggleRow(id: string) {
    setExpandedRow(prev => prev === id ? null : id)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const groupCounts: Record<string, number> = {
    needs_contact: stats.needsContact,
    following_up:  stats.followingUp,
    active:        stats.active,
    inactive:      stats.inactive,
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Volunteers</h1>
          <p className="text-gray-500 text-sm mt-0.5">{volunteers.length} total volunteers</p>
        </div>
        <Link
          href="/imports"
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
        >
          + Import CSV
        </Link>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Total',             value: stats.total,        cls: 'bg-gray-100 text-gray-700' },
          { label: 'Needs contact',     value: stats.needsContact, cls: stats.needsContact > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500' },
          { label: 'Following up',      value: stats.followingUp,  cls: 'bg-blue-100 text-blue-700' },
          { label: 'Active',            value: stats.active,       cls: 'bg-green-100 text-green-700' },
          { label: 'Inactive / paused', value: stats.inactive,     cls: 'bg-gray-100 text-gray-500' },
        ].map(s => (
          <span key={s.label} className={`rounded-full px-3 py-1 text-sm font-medium ${s.cls}`}>
            {s.value} {s.label}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search name, email, phone, town, notes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 sm:min-w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        <div className="flex gap-1 flex-wrap">
          {FILTER_GROUPS.map(g => (
            <button
              key={g.key}
              onClick={() => setGroupFilter(g.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                groupFilter === g.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {g.label}
              {g.key !== 'all' && (
                <span className={`ml-1.5 text-xs ${groupFilter === g.key ? 'text-gray-300' : 'text-gray-400'}`}>
                  ({groupCounts[g.key] ?? 0})
                </span>
              )}
            </button>
          ))}
        </div>
        {towns.length > 0 && (
          <select
            value={townFilter}
            onChange={e => setTownFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All towns</option>
            {towns.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {(search || groupFilter !== 'all' || townFilter) && (
          <button
            onClick={() => { setSearch(''); setGroupFilter('all'); setTownFilter('') }}
            className="text-sm text-gray-400 hover:text-gray-700"
          >
            Clear filters
          </button>
        )}
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">Volunteer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">Contact info</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm w-36">Stage</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">Last reached</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(v => {
              const name = v.full_name || [v.first_name, v.last_name].filter(Boolean).join(' ') || v.email || '(no name)'
              const isExpanded = expandedRow === v.id
              const nextStage = NEXT_STAGE[v.volunteer_stage ?? 'New']
              const form = getForm(v.id)
              const urgency = isExpanded ? '' : rowUrgencyClass(v.volunteer_stage, v.last_contact_date)

              return (
                <React.Fragment key={v.id}>
                  {/* ── Main row ── */}
                  <tr
                    className={`cursor-pointer transition-colors ${
                      isExpanded
                        ? 'bg-gray-50 border-b-0'
                        : `hover:bg-gray-50 ${urgency}`
                    }`}
                    onClick={() => toggleRow(v.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{name}</span>
                        {v.priority === 'High' && (
                          <span className="text-red-500 text-xs font-bold" title="High priority">●</span>
                        )}
                        {v.is_active_volunteer && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Active</span>
                        )}
                        {v.is_signature_collector && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Sig</span>
                        )}
                        <Link
                          href={`/contacts/${v.id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-gray-300 hover:text-blue-500 text-xs transition-colors"
                          title="Open full profile"
                        >
                          ↗
                        </Link>
                      </div>
                      {v.date_added && (
                        <div className="text-xs text-gray-400 mt-0.5">Added {v.date_added}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-600">
                      {[v.town, v.state].filter(Boolean).join(', ') || '—'}
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {v.phone ? (
                          <a
                            href={`tel:${v.phone}`}
                            onClick={e => e.stopPropagation()}
                            className="block text-sm text-gray-700 hover:text-blue-600 transition-colors"
                          >
                            {v.phone}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-300">No phone</span>
                        )}
                        {v.email && (
                          <a
                            href={`mailto:${v.email}`}
                            onClick={e => e.stopPropagation()}
                            className="block text-xs text-gray-400 hover:text-blue-600 truncate max-w-[200px] transition-colors"
                          >
                            {v.email}
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <select
                        value={v.volunteer_stage ?? 'New'}
                        onChange={e => handleStageChange(v.id, e.target.value)}
                        disabled={savingStage === v.id}
                        className={`text-xs font-medium px-2 py-1 rounded-full border cursor-pointer focus:outline-none transition-colors disabled:opacity-50 ${
                          STAGE_COLORS[v.volunteer_stage ?? 'New'] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {VOLUNTEER_STAGES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <div className={`text-sm font-medium ${!v.last_contact_date ? 'text-amber-700' : 'text-gray-700'}`}>
                        {daysAgo(v.last_contact_date)}
                      </div>
                      {v.last_contact_summary && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{v.last_contact_summary}</p>
                      )}
                    </td>
                  </tr>

                  {/* ── Expanded detail + log row ── */}
                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 pb-5 pt-0">
                        <div className="border border-gray-200 rounded-xl bg-white p-5 space-y-5">

                          {/* Notes — most prominent */}
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Notes & offer</p>
                            {v.notes ? (
                              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{v.notes}</p>
                            ) : (
                              <p className="text-sm text-gray-400 italic">No notes recorded.</p>
                            )}
                          </div>

                          {/* Contact details recap */}
                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm border-t pt-4">
                            {v.email && (
                              <a href={`mailto:${v.email}`} className="text-blue-600 hover:underline">{v.email}</a>
                            )}
                            {v.phone && (
                              <a href={`tel:${v.phone}`} className="text-gray-700 hover:text-blue-600">{v.phone}</a>
                            )}
                            {(v.town || v.state) && (
                              <span className="text-gray-500">{[v.town, v.state].filter(Boolean).join(', ')}</span>
                            )}
                            <Link href={`/contacts/${v.id}`} className="text-gray-400 hover:text-blue-600 ml-auto text-xs">
                              View full profile →
                            </Link>
                          </div>

                          {/* Log contact form */}
                          <div className="border-t pt-4 space-y-3">
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Log contact</p>
                            <div className="flex flex-wrap gap-2 items-center">
                              <select
                                value={form.type}
                                onChange={e => setFormField(v.id, 'type', e.target.value)}
                                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                              >
                                {INTERACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <input
                                type="text"
                                placeholder="What happened? e.g. Left voicemail, sent volunteer ask…"
                                value={form.summary}
                                onChange={e => setFormField(v.id, 'summary', e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !savingLog && form.summary.trim() && submitLog(v)}
                                className="flex-1 min-w-56 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            </div>
                            {nextStage && (
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={form.advanceStage}
                                  onChange={e => setFormField(v.id, 'advanceStage', e.target.checked)}
                                  className="rounded"
                                />
                                <span className="text-sm text-gray-600">
                                  Advance stage to{' '}
                                  <span className={`font-medium px-1.5 py-0.5 rounded text-xs border ${STAGE_COLORS[nextStage] ?? ''}`}>
                                    {nextStage}
                                  </span>
                                </span>
                              </label>
                            )}
                            <div className="flex gap-2 items-center">
                              <button
                                onClick={() => submitLog(v)}
                                disabled={!form.summary.trim() || savingLog === v.id}
                                className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                {savingLog === v.id ? 'Saving…' : 'Log contact'}
                              </button>
                              <button
                                onClick={() => toggleRow(v.id)}
                                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
                              >
                                Collapse
                              </button>
                            </div>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            No volunteers match these filters.
          </div>
        )}
      </div>
    </div>
  )
}
