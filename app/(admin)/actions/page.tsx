import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 }

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('actions')
    .select('*, contact:contacts(full_name, display_id, date_added)')
    .not('status', 'in', '("Done","Dropped","Skipped")')
    .limit(500)

  if (params.assigned_to) query = query.eq('assigned_to', params.assigned_to)

  const { data: raw } = await query

  // Sort: priority first, then due date
  const actions = (raw ?? []).sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 3
    const pb = PRIORITY_ORDER[b.priority] ?? 3
    if (pa !== pb) return pa - pb
    return (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1
  })

  const filters = [
    { label: 'All', href: '/actions' },
    { label: 'High priority', href: '/actions?priority=High' },
    { label: 'Candidate', href: '/actions?assigned_to=candidate' },
    { label: 'Admin', href: '/actions?assigned_to=admin' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Actions</h1>
          <p className="text-sm text-gray-500 mt-0.5">{actions.length} open — sorted by priority</p>
        </div>
        <div className="flex gap-2">
          {filters.map(f => (
            <Link key={f.href} href={f.href} className="text-xs text-gray-500 hover:text-gray-900 border rounded px-2 py-1">{f.label}</Link>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Contact</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Priority</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Assigned</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Due</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {actions.map(action => (
              <tr key={action.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3">
                  <Link href={`/actions/${action.id}`} className="block">
                    <p className="font-medium text-gray-900 hover:text-blue-600">{action.title}</p>
                    {action.suggested_ask && (
                      <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{action.suggested_ask}</p>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {action.contact ? (
                    <div>
                      <Link href={`/contacts/${action.contact_id}`} className="text-blue-600 hover:underline text-sm">
                        {action.contact.full_name}
                      </Link>
                      {action.contact.date_added && (
                        <p className="text-xs text-gray-400 mt-0.5">Since {action.contact.date_added}</p>
                      )}
                    </div>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  {action.priority === 'High' && <Badge variant="destructive">High</Badge>}
                  {action.priority === 'Medium' && <Badge variant="default">Med</Badge>}
                  {action.priority === 'Low' && <Badge variant="secondary">Low</Badge>}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={action.assigned_to === 'candidate' ? 'default' : 'outline'}>
                    {action.assigned_to === 'candidate' ? 'Candidate' : 'Admin'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {action.due_date ? (
                    <span className={`text-xs ${action.due_date < today ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {action.due_date < today ? `Overdue` : action.due_date}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={action.status === 'Not started' ? 'outline' : 'secondary'}>{action.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {actions.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-500">No open actions.</div>
        )}
      </div>
    </div>
  )
}
