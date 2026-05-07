import { createClient } from '@/lib/supabase/server'
import TaskTemplates from '@/components/admin/TaskTemplates'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('task_templates')
    .select('id, title, description, suggested_ask, suggested_message, action_type, action_area, priority, created_at')
    .order('title')

  return <TaskTemplates initialTemplates={(templates ?? []) as any} />
}
