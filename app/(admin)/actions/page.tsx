import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

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
    .select('*, contact:contacts(full_name, display_id)')
    .not('status', 'in', '("Done","Dropped","Skipped")')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(100)

  if (params.assigned_to) query = query.eq('assigned_to', params.assigned_to)

  const { data: actions } = await query

  const statusColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    'Not started': 'outline',
    'In progress': 'default',
    'Contacted': 'secondary',
    'Waiting on response': 'secondary',
    'Responded': 'default',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Actions</h1>
        <div className="flex gap-2">
          <Link href="/actions" className="text-xs text-gray-500 hover:text-gray-900 border rounded px-2 py-1">All</Link>
          <Link href="/actions?assigned_to=candidate" className="text-xs text-gray-500 hover:text-gray-900 border rounded px-2 py-1">Candidate</Link>
          <Link href="/actions?assigned_to=admin" className="text-xs text-gray-500 hover:text-gray-900 border rounded px-2 py-1">Admin</Link>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Contact</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Assigned</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Priority</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Due</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {actions?.map(action => (
              <tr key={action.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{action.title}</p>
                  {action.suggested_ask && (
                    <p className="text-xs text-gray-400 truncate max-w-xs">{action.suggested_ask}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {action.contact ? (
                    <Link href={`/contacts/${action.contact_id}`} className="text-blue-600 hover:underline">
                      {action.contact.full_name}
                    </Link>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{action.action_type}</td>
                <td className="px-4 py-3">
                  <Badge variant={action.assigned_to === 'candidate' ? 'default' : 'secondary'}>
                    {action.assigned_to === 'candidate' ? 'Candidate' : 'Admin'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {action.priority === 'High' && <Badge variant="destructive">High</Badge>}
                  {action.priority === 'Medium' && <Badge variant="default">Med</Badge>}
                  {action.priority === 'Low' && <Badge variant="secondary">Low</Badge>}
                </td>
                <td className="px-4 py-3">
                  {action.due_date ? (
                    <span className={`text-xs ${action.due_date < today ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {action.due_date < today ? `Overdue (${action.due_date})` : action.due_date}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusColor[action.status] ?? 'outline'}>{action.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!actions || actions.length === 0) && (
          <div className="text-center py-12 text-sm text-gray-500">
            No open actions. Import contacts to generate actions automatically.
          </div>
        )}
      </div>
    </div>
  )
}
