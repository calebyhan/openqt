/**
 * Leaderboard — Members sorted by current_streak descending.
 */
import { useEffect, useState } from 'react'
import { Flame, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

interface MemberRow {
  user_id: string
  current_streak: number
  longest_streak: number
  display_name: string
  avatar_url: string | null
}

interface Props {
  campaignId: string
}

export default function Leaderboard({ campaignId }: Props) {
  const { user } = useAuthStore()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('campaign_members')
      .select('user_id, current_streak, longest_streak, profiles(display_name, avatar_url)')
      .eq('campaign_id', campaignId)
      .order('current_streak', { ascending: false })
      .then(({ data }) => {
        setMembers(
          (data ?? []).map((r) => ({
            user_id: r.user_id,
            current_streak: r.current_streak,
            longest_streak: r.longest_streak,
            display_name:
              (r.profiles as { display_name: string; avatar_url: string | null } | null)
                ?.display_name ?? 'Unknown',
            avatar_url:
              (r.profiles as { display_name: string; avatar_url: string | null } | null)
                ?.avatar_url ?? null,
          })),
        )
        setLoading(false)
      })
  }, [campaignId])

  if (loading) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
  }

  if (members.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted-foreground text-center">
        No members yet.
      </p>
    )
  }

  return (
    <div className="space-y-1 px-4 py-2">
      {members.map((m, i) => {
        const isMe = m.user_id === user?.id
        return (
          <div
            key={m.user_id}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2',
              isMe ? 'bg-primary/5' : 'hover:bg-accent',
            )}
          >
            {/* Rank */}
            <div className="w-5 text-center">
              {i === 0 ? (
                <Trophy className="h-4 w-4 text-yellow-500" />
              ) : (
                <span className="text-xs text-muted-foreground">{i + 1}</span>
              )}
            </div>

            {/* Avatar */}
            {m.avatar_url ? (
              <img
                src={m.avatar_url}
                alt={m.display_name}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {m.display_name.slice(0, 1).toUpperCase()}
              </div>
            )}

            {/* Name */}
            <p className={cn('flex-1 text-sm', isMe && 'font-medium')}>
              {m.display_name}
              {isMe && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
            </p>

            {/* Streak */}
            <div className="flex items-center gap-1 text-sm font-medium">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              {m.current_streak}
            </div>
          </div>
        )
      })}
    </div>
  )
}
