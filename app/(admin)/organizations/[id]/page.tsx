import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import OrgEditor from '@/components/admin/OrgEditor'

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single()

  if (!org) notFound()

  return <OrgEditor org={org} />
}
