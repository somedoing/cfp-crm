'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

type Contact = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  town: string | null
  state: string | null
  is_volunteer: boolean
  is_donor: boolean
  is_signature_collector: boolean
  volunteer_stage: string | null
  donor_stage: string | null
  priority: string | null
  date_added: string | null
  do_not_contact: boolean
}

type SortCol = 'date_added' | 'full_name' | 'town' | 'volunteer_stage'
type SortDir = 'asc' | 'desc'

function priorityScore(p: string | null) {
  if (p === 'High') return 0
  if (p === 'Medium') return 1
  return 2
}

function actionParamsForContact(contact: Contact) {
  const today = new Date()
  let priority = 'Low'
  let dueDays = 7

  if (contact.date_added) {
    const added = new Date(contact.date_added)
    const daysSince = Math.floor((today.getTime() - added.getTime()) / 86400000)
    if (daysSince <= 7) { priority = 'High'; dueDays = 1 }
    else if (added.getFullYear() >= 2026) { priority = 'Medium'; dueDays = 3 }
  }

  const dueDate = new Date(today)
  dueDate.setDate(dueDate.getDate() + dueDays)

  return {
    contact_id: contact.id,
    title: `Follow up with ${contact.full_name}`,
    priority,
    action_type: 'Follow-up',
    action_area: 'General Supporter Follow-Up',
    assigned_to: 'admin',
    status: 'Needs Review',
    due_date: dueDate.toISOString().split('T')[0],
  }
}

export default function ContactsClient({
  contacts,
  openContactIds,
}: {
  contacts: Contact[]
  openContactIds: string[]
}) {
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'volunteer' | 'donor' | 'sig'>('all')
  const [outreachFilter, setOutreachFilter] = useState<'needs' | 'all'>('all')
  const [sortCol, setSortCol] = useState<SortCol>('date_added')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [batchAdding, setBatchAdding] = useState(false)

  const openIds = useMemo(
    () => {
      const s = new Set([...openContactIds, ...addedIds])
      removedIds.forEach(id => s.delete(id))
      return s
    },
    [openContactIds, addedIds, removedIds]
  )

  const needsOutreachCount = useMemo(
    () => contacts.filter(c => !c.do_not_contact && !openIds.has(c.id)).length,
    [contacts, openIds]
  )

  const filtered = useMemo(() => {
    let result = contacts.filter(c => !c.do_not_contact)

    if (outreachFilter === 'needs') result = result.filter(c => !openIds.has(c.id))
    if (typeFilter === 'volunteer') result = result.filter(c => c.is_volunteer)
    if (typeFilter === 'donor') result = result.filter(c => c.is_donor)
    if (typeFilter === 'sig') result = result.filter(c => c.is_signature_collector)

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        c =>
          c.full_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.town?.toLowerCase().includes(q)
      )
    }

    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'date_added') {
        const da = a.date_added ?? ''
        const db = b.date_added ?? ''
        cmp = da < db ? -1 : da > db ? 1 : 0
        // secondary: priority
        if (cmp === 0) cmp = priorityScore(a.priority) - priorityScore(b.priority)
      } else if (sortCol === 'full_name') {
        cmp = (a.full_name ?? '').localeCompare(b.full_name ?? '')
      } else if (sortCol === 'town') {
        cmp = (a.town ?? '').localeCompare(b.town ?? '')
      } else if (sortCol === 'volunteer_stage') {
        cmp = (a.volunteer_stage ?? 'zzz').localeCompare(b.volunteer_stage ?? 'zzz')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [contacts, search, typeFilter, outreachFilter, openIds, sortCol, sortDir])

  const visible = filtered.slice(0, 200)
  const visibleIds = useMemo(() => new Set(visible.map(c => c.id)), [visible])

  const selectedVisible = useMemo(
    () => [...selected].filter(id => visibleIds.has(id)),
    [selected, visibleIds]
  )
  const allVisibleSelected =
    visible.length > 0 && visible.every(c => selected.has(c.id))
  const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'date_added' ? 'desc' : 'asc')
    }
  }

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
        visible.forEach(c => next.delete(c.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        visible.forEach(c => next.add(c.id))
        return next
      })
    }
  }

  async function addSelected() {
    const toAdd = visible.filter(c => selected.has(c.id) && !openIds.has(c.id))
    if (toAdd.length === 0) return

    setBatchAdding(true)
    const rows = toAdd.map(actionParamsForContact)
    await supabase.from('actions').insert(rows)
    const newIds = new Set(toAdd.map(c => c.id))
    setAddedIds(prev => new Set([...prev, ...newIds]))
    setSelected(prev => {
      const next = new Set(prev)
      newIds.forEach(id => next.delete(id))
      return next
    })
    setBatchAdding(false)
  }

  async function removeFromPipeline(contactId: string) {
    setRemovedIds(prev => new Set([...prev, contactId]))
    const { data } = await supabase
      .from('actions')
      .select('id')
      .eq('contact_id', contactId)
      .not('status', 'in', '("Done","Committed","Declined","Unresponsive","Dropped","Skipped")')
    if (data && data.length > 0) {
      await supabase.from('actions').delete().in('id', data.map((a: any) => a.id))
    }
  }

  async function addSingle(contact: Contact) {
    setSelected(prev => {
      const next = new Set(prev)
      next.add(contact.id)
      return next
    })
    await supabase.from('actions').insert(actionParamsForContact(contact))
    setAddedIds(prev => new Set([...prev, contact.id]))
    setSelected(prev => {
      const next = new Set(prev)
      next.delete(contact.id)
      return next
    })
  }

  const typeOptions = [
    { key: 'all', label: 'All' },
    { key: 'volunteer', label: 'Volunteers' },
    { key: 'donor', label: 'Donors' },
    { key: 'sig', label: 'Signature' },
  ] as const

  function downloadCSV() {
    const label = typeFilter === 'volunteer' ? 'volunteers' : typeFilter === 'donor' ? 'donors' : typeFilter === 'sig' ? 'sig-collectors' : 'contacts'
    const date = new Date().toISOString().split('T')[0]
    const filename = `${label}-${date}.csv`

    const headers = ['Name', 'Email', 'Phone', 'Town', 'State', 'Volunteer', 'Donor', 'Signature Collector', 'Volunteer Stage', 'Donor Stage', 'Date Added', 'Priority']
    const rows = filtered.map(c => [
      c.full_name ?? '',
      c.email ?? '',
      c.phone ?? '',
      c.town ?? '',
      c.state ?? '',
      c.is_volunteer ? 'Yes' : 'No',
      c.is_donor ? 'Yes' : 'No',
      c.is_signature_collector ? 'Yes' : 'No',
      c.volunteer_stage ?? '',
      c.donor_stage ?? '',
      c.date_added ?? '',
      c.priority ?? '',
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function SortArrow({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
          {outreachFilter === 'needs' && (
            <p className="text-gray-500 mt-0.5">
              {needsOutreachCount.toLocaleString()} contacts need outreach
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500">{filtered.length.toLocaleString()} shown</span>
          <button
            onClick={downloadCSV}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            ↓ Download CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search name, email, town…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 min-w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="flex gap-1">
          {typeOptions.map(o => (
            <button
              key={o.key}
              onClick={() => setTypeFilter(o.key)}
              className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                typeFilter === o.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setOutreachFilter('needs')}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              outreachFilter === 'needs'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Needs outreach
          </button>
          <button
            onClick={() => setOutreachFilter('all')}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              outreachFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
        </div>

        {/* Batch action bar */}
        {selectedVisible.length > 0 && (
          <div className="flex items-center gap-2 ml-auto bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span className="text-blue-700 font-medium">
              {selectedVisible.length} selected
            </span>
            <button
              onClick={addSelected}
              disabled={batchAdding}
              className="bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {batchAdding ? 'Adding…' : `Add ${selectedVisible.length} to pipeline`}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-blue-400 hover:text-blue-600"
            >
              Clear
            </button>
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
              <th
                className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none"
                onClick={() => toggleSort('full_name')}
              >
                Name <SortArrow col="full_name" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
              <th
                className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none"
                onClick={() => toggleSort('town')}
              >
                Town <SortArrow col="town" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th
                className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none"
                onClick={() => toggleSort('volunteer_stage')}
              >
                Stage <SortArrow col="volunteer_stage" />
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none"
                onClick={() => toggleSort('date_added')}
              >
                Added <SortArrow col="date_added" />
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map(contact => {
              const inPipeline = openIds.has(contact.id)
              const isSelected = selected.has(contact.id)
              const location = [contact.town, contact.state].filter(Boolean).join(', ')

              return (
                <tr
                  key={contact.id}
                  className={`hover:bg-gray-50 ${!inPipeline ? 'cursor-pointer' : ''} ${isSelected ? 'bg-blue-50' : ''}`}
                  onClick={() => !inPipeline && toggleRow(contact.id)}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {!inPipeline && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(contact.id)}
                        className="rounded"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium text-blue-600 hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      {contact.full_name}
                    </Link>
                    {contact.priority === 'High' && (
                      <span className="ml-2 text-red-500 font-medium">·· High</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{contact.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{location || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {contact.is_volunteer && <Badge variant="secondary">Vol</Badge>}
                      {contact.is_donor && <Badge variant="secondary">Donor</Badge>}
                      {contact.is_signature_collector && <Badge variant="secondary">Sig</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {contact.volunteer_stage ?? contact.donor_stage ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{contact.date_added ?? '—'}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    {inPipeline ? (
                      <button
                        onClick={e => { e.stopPropagation(); removeFromPipeline(contact.id) }}
                        className="text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-300 rounded px-2 py-1 transition-colors"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => addSingle(contact)}
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
          <div className="text-center py-12 text-gray-500">No contacts match these filters.</div>
        )}
        {filtered.length > 200 && (
          <div className="text-center py-4 text-gray-400 border-t">
            Showing 200 of {filtered.length.toLocaleString()} — use search or filters to narrow down
          </div>
        )}
      </div>
    </div>
  )
}
