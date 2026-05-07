'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const ACTION_TYPES = ['Call', 'Text', 'Email', 'Discord DM', 'Follow-up', 'Thank-you', 'Invite', 'Check in', 'Pitch', 'Schedule meeting']
const ACTION_AREAS = ['Volunteers', 'Signature Collection', 'Discord', 'Donations', 'Media', 'Organization Outreach', 'Candidate Partners', 'Events', 'General Supporter Follow-Up']
const PRIORITIES = ['High', 'Medium', 'Low']

export type TaskTemplate = {
  id: string
  title: string
  description: string | null
  suggested_ask: string | null
  suggested_message: string | null
  action_type: string
  action_area: string | null
  priority: string
  created_at: string
}

const EMPTY_FORM = {
  title: '',
  description: '',
  suggested_ask: '',
  suggested_message: '',
  action_type: 'Email',
  action_area: 'General Supporter Follow-Up',
  priority: 'Medium',
}

export default function TaskTemplates({ initialTemplates }: { initialTemplates: TaskTemplate[] }) {
  const supabase = createClient()
  const [templates, setTemplates] = useState(initialTemplates)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startNew() {
    setForm(EMPTY_FORM)
    setEditing('new')
  }

  function startEdit(t: TaskTemplate) {
    setForm({
      title: t.title,
      description: t.description ?? '',
      suggested_ask: t.suggested_ask ?? '',
      suggested_message: t.suggested_message ?? '',
      action_type: t.action_type,
      action_area: t.action_area ?? 'General Supporter Follow-Up',
      priority: t.priority,
    })
    setEditing(t.id)
  }

  function cancelEdit() {
    setEditing(null)
    setError('')
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')

    const data = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      suggested_ask: form.suggested_ask.trim() || null,
      suggested_message: form.suggested_message.trim() || null,
      action_type: form.action_type,
      action_area: form.action_area || null,
      priority: form.priority,
    }

    if (editing === 'new') {
      const { data: created, error: e } = await supabase
        .from('task_templates')
        .insert(data)
        .select()
        .single()
      if (e) { setError(e.message); setSaving(false); return }
      setTemplates(prev => [created!, ...prev])
    } else if (editing) {
      const { error: e } = await supabase
        .from('task_templates')
        .update(data)
        .eq('id', editing)
      if (e) { setError(e.message); setSaving(false); return }
      setTemplates(prev => prev.map(t => t.id === editing ? { ...t, ...data } : t))
    }

    setEditing(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template? Actions using it will not be affected.')) return
    await supabase.from('task_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const FormPanel = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">{editing === 'new' ? 'New template' : 'Edit template'}</h3>

      <div className="space-y-1">
        <label className="text-xs text-gray-500 font-medium">Title *</label>
        <Input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Volunteer outreach — first contact"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-500 font-medium">Description (internal context for the sender)</label>
        <Textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="What is this task for? What should the sender know?"
          className="text-sm h-16 resize-none"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-500 font-medium">Suggested ask (shown to sender)</label>
        <Textarea
          value={form.suggested_ask}
          onChange={e => setForm(f => ({ ...f, suggested_ask: e.target.value }))}
          placeholder="What should they ask or accomplish in this contact?"
          className="text-sm h-14 resize-none"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-500 font-medium">Message template (sender can copy/adapt)</label>
        <Textarea
          value={form.suggested_message}
          onChange={e => setForm(f => ({ ...f, suggested_message: e.target.value }))}
          placeholder="Draft message the sender can adapt and send…"
          className="text-sm h-24 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">Action type</label>
          <Select value={form.action_type} onValueChange={v => setForm(f => ({ ...f, action_type: v ?? f.action_type }))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{ACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">Area</label>
          <Select value={form.action_area} onValueChange={v => setForm(f => ({ ...f, action_area: v ?? f.action_area }))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{ACTION_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">Priority</label>
          <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v ?? f.priority }))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Saving…' : 'Save template'}
        </Button>
        <Button variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Task Templates</h1>
          <p className="text-gray-500 text-sm mt-0.5">Reusable task descriptions for the sender pipeline</p>
        </div>
        {!editing && (
          <Button onClick={startNew} size="sm">+ New template</Button>
        )}
      </div>

      {editing && <FormPanel />}

      {templates.length === 0 && !editing && (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-2">No templates yet.</p>
          <button onClick={startNew} className="text-blue-600 hover:underline text-sm">Create your first template →</button>
        </div>
      )}

      <div className="space-y-2">
        {templates.map(t => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{t.title}</span>
                  <Badge variant="outline">{t.action_type}</Badge>
                  {t.priority === 'High' && <Badge variant="destructive">High</Badge>}
                  {t.priority === 'Medium' && <Badge>Med</Badge>}
                  {t.priority === 'Low' && <Badge variant="secondary">Low</Badge>}
                  {t.action_area && <span className="text-xs text-gray-400">{t.action_area}</span>}
                </div>
                {t.description && <p className="text-sm text-gray-600">{t.description}</p>}
                {t.suggested_ask && (
                  <p className="text-sm text-blue-700 bg-blue-50 rounded px-2 py-1">
                    <span className="font-medium">Ask: </span>{t.suggested_ask}
                  </p>
                )}
                {t.suggested_message && (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded px-2 py-1 whitespace-pre-wrap line-clamp-3">
                    {t.suggested_message}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => startEdit(t)} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-1">
                  Edit
                </button>
                <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded px-2 py-1">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
