'use client'

import { useState, useTransition } from 'react'
import { inviteUser, updateUserRole } from '@/app/(admin)/team/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Profile = {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'sender'
}

export default function TeamManager({ profiles: initial }: { profiles: Profile[] }) {
  const [profiles, setProfiles] = useState(initial)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'admin' | 'sender'>('sender')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [isPending, startTransition] = useTransition()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  function handleInvite() {
    if (!email.trim()) return
    setInviteError('')
    setInviteSuccess('')
    startTransition(async () => {
      const result = await inviteUser(email.trim(), fullName.trim(), role)
      if (result.error) {
        setInviteError(result.error)
      } else {
        setInviteSuccess(`Invite sent to ${email}`)
        setEmail('')
        setFullName('')
        setRole('sender')
      }
    })
  }

  async function handleRoleChange(userId: string, newRole: 'admin' | 'sender') {
    setUpdatingId(userId)
    const result = await updateUserRole(userId, newRole)
    if (!result.error) {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p))
    }
    setUpdatingId(null)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Existing team */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Current team ({profiles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100">
            {profiles.map(profile => (
              <div key={profile.id} className="flex items-center justify-between py-3 gap-4">
                <div>
                  <div className="font-medium text-gray-900">
                    {profile.full_name || profile.email}
                  </div>
                  {profile.full_name && (
                    <div className="text-gray-500 text-sm">{profile.email}</div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge
                    className={profile.role === 'admin'
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : 'bg-gray-100 text-gray-600 border-gray-200'}
                  >
                    {profile.role === 'admin' ? 'Admin' : 'Candidate'}
                  </Badge>
                  <button
                    onClick={() => handleRoleChange(
                      profile.id,
                      profile.role === 'admin' ? 'sender' : 'admin'
                    )}
                    disabled={updatingId === profile.id}
                    className="text-gray-400 hover:text-gray-700 text-sm disabled:opacity-40"
                  >
                    {updatingId === profile.id
                      ? 'Saving…'
                      : `Make ${profile.role === 'admin' ? 'sender' : 'admin'}`}
                  </button>
                </div>
              </div>
            ))}
            {profiles.length === 0 && (
              <p className="text-gray-400 text-sm py-4 text-center">No team members yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invite form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Invite someone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="person@example.com"
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Full name"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Role</Label>
            <div className="flex gap-3 mt-1">
              {(['sender', 'admin'] as const).map(r => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700 capitalize">{r}</span>
                  <span className="text-xs text-gray-400">
                    {r === 'admin' ? '— full access' : '— pipeline + contact notes only'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleInvite} disabled={isPending || !email.trim()}>
              {isPending ? 'Sending…' : 'Send invite'}
            </Button>
            {inviteSuccess && <span className="text-green-600 text-sm">{inviteSuccess}</span>}
          </div>
          {inviteError && <p className="text-red-600 text-sm">{inviteError}</p>}
          <p className="text-gray-400 text-xs">
            They'll get an email with a link to set their password and log in.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
