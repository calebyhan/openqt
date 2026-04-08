import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Tables } from '@/types/supabase'

interface GroupWithRole {
  group: Tables<'groups'>
  role: 'owner' | 'admin' | 'member'
}

export default function GroupsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<GroupWithRole[]>([])
  const [loading, setLoading] = useState(true)

  // Create group dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Join by code
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('group_members')
      .select('role, groups(id, name, description, invite_code, created_by, created_at)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setGroups(
          (data ?? [])
            .filter((row) => row.groups)
            .map((row) => ({
              group: row.groups as unknown as Tables<'groups'>,
              role: row.role as GroupWithRole['role'],
            })),
        )
        setLoading(false)
      })
  }, [user])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !newName.trim() || creating) return
    setCreating(true)
    setCreateError(null)

    // Generate the ID client-side so we can insert the member row before selecting,
    // avoiding the RLS catch-22 where .insert().select() runs the SELECT policy
    // before the user is a group_member.
    const groupId = crypto.randomUUID()

    const { error: groupErr } = await supabase
      .from('groups')
      .insert({ id: groupId, name: newName.trim(), description: newDesc.trim() || null, created_by: user.id })

    if (groupErr) {
      setCreateError('Failed to create group.')
      setCreating(false)
      return
    }

    await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: user.id, role: 'owner' })

    setCreating(false)
    setCreateOpen(false)
    setNewName('')
    setNewDesc('')
    navigate(`/groups/${groupId}`)
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !joinCode.trim() || joining) return
    setJoining(true)
    setJoinError(null)

    const { data: group, error: findErr } = await supabase
      .rpc('find_group_by_invite_code', { code: joinCode.trim() })
      .single()

    if (findErr || !group) {
      setJoinError('Invalid invite code.')
      setJoining(false)
      return
    }

    const { error: joinErr } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id, role: 'member' })

    // 23505 = unique_violation (already a member) — treat as success
    if (joinErr && joinErr.code !== '23505') {
      setJoinError('Could not join group.')
      setJoining(false)
      return
    }

    setJoining(false)
    setJoinCode('')
    navigate(`/groups/${group.id}`)
  }

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Groups</h2>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a group</DialogTitle>
                <DialogDescription>
                  Give your group a name and optional description.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 pt-2">
                <Input
                  placeholder="Group name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
                <Input
                  placeholder="Description (optional)"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
                {createError && <p className="text-sm text-destructive">{createError}</p>}
                <Button type="submit" disabled={creating || !newName.trim()} className="w-full">
                  {creating ? 'Creating…' : 'Create group'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <form onSubmit={handleJoin} className="flex gap-2">
          <Input
            placeholder="Paste invite code to join a group…"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="outline" disabled={joining || !joinCode.trim()}>
            {joining ? 'Joining…' : 'Join'}
          </Button>
        </form>
        {joinError && <p className="-mt-3 text-sm text-destructive">{joinError}</p>}

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && groups.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No groups yet.</p>
            <p className="text-xs text-muted-foreground">
              Create one or paste an invite code above.
            </p>
          </div>
        )}

        {!loading && groups.length > 0 && (
          <ul className="space-y-2">
            {groups.map(({ group }) => (
              <li key={group.id}>
                <button
                  onClick={() => navigate(`/groups/${group.id}`)}
                  className="w-full rounded-lg border p-4 text-left hover:bg-accent"
                >
                  <p className="font-medium">{group.name}</p>
                  {group.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                      {group.description}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}
