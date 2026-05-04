'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'

const ORG_TYPES = ['Union', 'Nonprofit', 'Business', 'Community Group', 'Media Outlet', 'Political Organization', 'Allied Campaign', 'Coalition Partner', 'Other']
const OUTREACH_STAGES = ['Researching', 'Warm intro needed', 'Contacted', 'Meeting requested', 'Meeting scheduled', 'Supportive', 'Active partner', 'Declined', 'Dormant']

type OrgData = {
  id: string
  name: string
  org_type: string | null
  website: string | null
  region: string | null
  town: string | null
  state: string | null
  outreach_stage: string | null
  current_ask: string | null
  notes: string | null
  last_contact_date: string | null
}

export default function OrgEditor({ org }: { org: OrgData | null }) {
  const router = useRouter()
  const supabase = createClient()
  const isNew = org === null

  const [name, setName] = useState(org?.name ?? '')
  const [orgType, setOrgType] = useState(org?.org_type ?? '')
  const [website, setWebsite] = useState(org?.website ?? '')
  const [region, setRegion] = useState(org?.region ?? '')
  const [town, setTown] = useState(org?.town ?? '')
  const [state, setState] = useState(org?.state ?? 'NH')
  const [outreachStage, setOutreachStage] = useState(org?.outreach_stage ?? 'Researching')
  const [currentAsk, setCurrentAsk] = useState(org?.current_ask ?? '')
  const [notes, setNotes] = useState(org?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)

    const payload = {
      name: name.trim(),
      org_type: orgType || null,
      website: website || null,
      region: region || null,
      town: town || null,
      state: state || null,
      outreach_stage: outreachStage || null,
      current_ask: currentAsk || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }

    if (isNew) {
      const { data } = await supabase.from('organizations').insert(payload).select('id').single()
      if (data) router.push(`/organizations/${data.id}`)
    } else {
      await supabase.from('organizations').update(payload).eq('id', org.id)
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function addToPipeline() {
    if (!org) return
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 3)
    await supabase.from('actions').insert({
      org_id: org.id,
      title: `Reach out to ${org.name}`,
      priority: 'Medium',
      action_type: 'Email',
      action_area: 'Organization Outreach',
      assigned_to: 'admin',
      status: 'Not started',
      due_date: dueDate.toISOString().split('T')[0],
    })
    router.push('/actions')
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/organizations" className="text-gray-500 hover:text-gray-900">← Back to organizations</Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>{isNew ? 'New Organization' : 'Edit Organization'}</CardTitle>
            {!isNew && (
              <Button size="sm" variant="outline" onClick={addToPipeline}>
                + Add to pipeline
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Organization name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={orgType} onValueChange={v => setOrgType(v ?? orgType)}>
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Outreach stage</Label>
              <Select value={outreachStage} onValueChange={v => setOutreachStage(v ?? outreachStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTREACH_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Town</Label>
              <Input value={town} onChange={e => setTown(e.target.value)} placeholder="e.g. Concord" />
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <Input value={state} onChange={e => setState(e.target.value)} placeholder="NH" />
            </div>
            <div className="space-y-1">
              <Label>Region</Label>
              <Input value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Southern NH" />
            </div>
            <div className="space-y-1">
              <Label>Website</Label>
              <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Current ask</Label>
            <Input value={currentAsk} onChange={e => setCurrentAsk(e.target.value)} placeholder="What are we asking them to do?" />
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="resize-none h-24"
              placeholder="Background, connections, context…"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : isNew ? 'Create organization' : 'Save'}
            </Button>
            {saved && <span className="text-green-600">Saved</span>}
            <Link href="/organizations" className="text-gray-500 hover:text-gray-900 ml-auto">Cancel</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
