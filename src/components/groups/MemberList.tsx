import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'

interface Member {
  id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
  profiles: { display_name: string; avatar_url: string | null } | null
}

interface Props {
  groupId: string
}

export default function MemberList({ groupId }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('group_members')
      .select('id, role, joined_at, profiles(display_name, avatar_url)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true })
      .then(({ data }) => {
        setMembers((data ?? []) as unknown as Member[])
        setLoading(false)
      })
  }, [groupId])

  if (loading) return <p className="text-sm text-muted-foreground">Loading members…</p>

  return (
    <ul className="space-y-2">
      {members.map((m) => (
        <li key={m.id} className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {m.profiles?.display_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="flex-1 text-sm">{m.profiles?.display_name ?? 'Unknown'}</span>
          {m.role !== 'member' && (
            <Badge variant="secondary" className="text-xs capitalize">
              {m.role}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  )
}
