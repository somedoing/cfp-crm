import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import ImportUploader from '@/components/admin/ImportUploader'
import Link from 'next/link'

export default async function ImportsPage() {
  const supabase = await createClient()

  const { data: imports } = await supabase
    .from('imports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Imports</h1>

      <ImportUploader />

      {imports && imports.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-700">Recent Imports</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">File</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Source Form</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Rows</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Processed</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {imports.map(imp => (
                <tr key={imp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{imp.filename}</td>
                  <td className="px-4 py-3 text-gray-600">{imp.source_form}</td>
                  <td className="px-4 py-3 text-gray-600">{imp.row_count}</td>
                  <td className="px-4 py-3 text-gray-600">{imp.processed_count}</td>
                  <td className="px-4 py-3">
                    <Badge variant={imp.status === 'processed' ? 'default' : imp.status === 'reviewing' ? 'secondary' : 'outline'}>
                      {imp.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(imp.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
