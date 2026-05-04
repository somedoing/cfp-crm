'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

type Org = {
  id: string
  name: string
  org_type: string | null
  town: string | null
  state: string | null
  region: string | null
  outreach_stage: string | null
  last_contact_date: string | null
  notes: string | null
}

const ORG_TYPES = ['Union', 'Nonprofit', 'Business', 'Community Group', 'Media Outlet', 'Political Organization', 'Allied Campaign', 'Coalition Partner', 'Other']

const STAGE_COLORS: Record<string, string> = {
  'Researching': 'bg-gray-100 text-gray-600',
  'Warm intro needed': 'bg-yellow-100 text-yellow-700',
  'Contacted': 'bg-blue-100 text-blue-700',
  'Meeting requested': 'bg-purple-100 text-purple-700',
  'Meeting scheduled': 'bg-purple-200 text-purple-800',
  'Supportive': 'bg-green-100 text-green-700',
  'Active partner': 'bg-green-200 text-green-800',
  'Declined': 'bg-red-100 text-red-600',
  'Dormant': 'bg-gray-200 text-gray-500',
}

function actionParamsForOrg(org: Org) {
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 3)
  return {
    org_id: org.id,
    contact_id: null,
    title: `Reach out to ${org.name}`,
    priority: 'Medium',
    action_type: 'Email',
    action_area: 'Organization Outreach',
    assigned_to: 'admin',
    status: 'Not started',
    due_date: dueDate.toISOString().split('T')[0],
  }
}

export default function OrganizationsClient({
  orgs,
  openOrgIds,
}: {
  orgs: Org[]
  openOrgIds: string[]
}) {
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [outreachFilter, setOutreachFilter] = useState<'needs' | 'all'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [batchAdding, setBatchAdding] = useState(false)

  const openIds = useMemo(
    () => new Set([...openOrgIds, ...addedIds]),
    [openOrgIds, addedIds]
  )

  const filtered = useMemo(() => {
    let result = [...orgs]

    if (outreachFilter === 'needs') result = result.filter(o => !openIds.has(o.id))
    if (typeFilter !== 'all') result = result.filter(o => o.org_type === typeFilter)

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        o =>
          o.name.toLowerCase().includes(q) ||
          o.town?.toLowerCase().includes(q) ||
          o.region?.toLowerCase().includes(q) ||
          o.org_type?.toLowerCase().includes(q)
      )
    }

    return result
  }, [orgs, search, typeFilter, outreachFilter, openIds])

  const needsOutreachCount = orgs.filter(o => !openIds.has(o.id)).length

  const allVisibleSelected = filtered.length > 0 && filtered.every(o => selected.has(o.id))
  const someVisibleSelected = filtered.some(o => selected.has(o.id)) && !allVisibleSelected

  function toggleRow(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(o => next.delete(o.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(o => next.add(o.id))
        return next
      })
    }
  }

  async function addSelected() {
    const toAdd = filtered.filter(o => selected.has(o.id) && !openIds.has(o.id))
    if (toAdd.length === 0) return
    setBatchAdding(true)
    await supabase.from('actions').insert(toAdd.map(actionParamsForOrg))
    const newIds = new Set(toAdd.map(o => o.id))
    setAddedIds(prev => new Set([...prev, ...newIds]))
    setSelected(prev => {
      const next = new Set(prev)
      newIds.forEach(id => next.delete(id))
      return next
    })
    setBatchAdding(false)
  }

  async function addSingle(org: Org) {
    await supabase.from('actions').insert(actionParamsForOrg(org))
    setAddedIds(prev => new Set([...prev, org.id]))
  }

  const selectedInView = filtered.filter(o => selected.has(o.id))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search name, town, region…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 min-w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All types</option>
          {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="flex gap-1">
          <button
            onClick={() => setOutreachFilter('needs')}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              outreachFilter === 'needs' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Needs outreach ({needsOutreachCount})
          </button>
          <button
            onClick={() => setOutreachFilter('all')}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              outreachFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({orgs.length})
          </button>
        </div>

        {selectedInView.length > 0 && (
          <div className="flex items-center gap-2 ml-auto bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span className="text-blue-700 font-medium">{selectedInView.length} selected</span>
            <button
              onClick={addSelected}
              disabled={batchAdding}
              className="bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {batchAdding ? 'Adding…' : `Add ${selectedInView.length} to pipeline`}
            </button>
            <button onClick={() => setSelected(new Set())} className="text-blue-400 hover:text-blue-600">Clear</button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={el => { if (el) el.indeterminate = someVisibleSelected }}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Organization</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Stage</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Last contact</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(org => {
              const inPipeline = openIds.has(org.id)
              const isSelected = selected.has(org.id)
              const location = [org.town, org.state ?? 'NH'].filter(Boolean).join(', ')
              const stageClass = org.outreach_stage ? (STAGE_COLORS[org.outreach_stage] ?? 'bg-gray-100 text-gray-600') : ''

              return (
                <tr
                  key={org.id}
                  className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                  onClick={() => !inPipeline && toggleRow(org.id)}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {!inPipeline && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(org.id)}
                        className="rounded"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/organizations/${org.id}`}
                      className="font-medium text-blue-600 hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      {org.name}
                    </Link>
                    {org.notes && (
                      <p className="text-gray-400 truncate max-w-xs">{org.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{org.org_type ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{location || '—'}</td>
                  <td className="px-4 py-3">
                    {org.outreach_stage ? (
                      <span className={`px-2 py-0.5 rounded text-sm font-medium ${stageClass}`}>
                        {org.outreach_stage}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{org.last_contact_date ?? '—'}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    {inPipeline ? (
                      <span className="text-gray-400">In pipeline</span>
                    ) : (
                      <button
                        onClick={() => addSingle(org)}
                        className="text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded px-2 py-1 transition-colors"
                      >
                        + Add
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No organizations yet.{' '}
            <Link href="/organizations/new" className="text-blue-600 hover:underline">Add one</Link>.
          </div>
        )}
      </div>
    </div>
  )
}
