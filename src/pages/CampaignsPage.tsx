import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Flame, BookOpen } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import type { Tables } from '@/types/supabase'

interface CampaignWithStreak {
  campaign: Tables<'campaigns'>
  current_streak: number
  role: 'creator' | 'member'
}

function formatDate(date: string | null) {
  if (!date) return null
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function CampaignCard({
  c,
  streak,
  badge,
  onClick,
}: {
  c: Tables<'campaigns'>
  streak?: number
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border p-4 text-left hover:bg-accent transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium truncate">{c.title}</p>
            {badge && (
              <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">
                {badge}
              </span>
            )}
            {!c.is_published && (
              <span className="text-xs rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                Draft
              </span>
            )}
          </div>
          {c.description && (
            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
              {c.description}
            </p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className={cn('flex items-center gap-1')}>
              <BookOpen className="h-3 w-3" />
              {c.type.replace(/_/g, ' ')}
            </span>
            {c.start_date && (
              <span>
                {formatDate(c.start_date)} – {formatDate(c.end_date)}
              </span>
            )}
          </div>
        </div>
        {streak !== undefined && streak > 0 && (
          <div className="flex items-center gap-1 text-sm font-medium shrink-0">
            <Flame className="h-4 w-4 text-orange-500" />
            {streak}
          </div>
        )}
      </div>
    </button>
  )
}

export default function CampaignsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<CampaignWithStreak[]>([])
  const [discoverable, setDiscoverable] = useState<Tables<'campaigns'>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function load() {
      // Campaigns the user created
      const { data: created } = await supabase
        .from('campaigns')
        .select('*')
        .eq('created_by', user!.id)
        .order('created_at', { ascending: false })

      // Campaigns the user has joined
      const { data: memberRows } = await supabase
        .from('campaign_members')
        .select('campaign_id, current_streak, campaigns(*)')
        .eq('user_id', user!.id)

      const createdIds = new Set((created ?? []).map((c) => c.id))

      const joined: CampaignWithStreak[] = (memberRows ?? [])
        .filter((r) => r.campaigns && !createdIds.has(r.campaign_id))
        .map((r) => ({
          campaign: r.campaigns as unknown as Tables<'campaigns'>,
          current_streak: r.current_streak,
          role: 'member',
        }))

      const createdList: CampaignWithStreak[] = (created ?? []).map((c) => {
        const memberRow = (memberRows ?? []).find((r) => r.campaign_id === c.id)
        return {
          campaign: c,
          current_streak: memberRow?.current_streak ?? 0,
          role: 'creator',
        }
      })

      const allJoinedIds = new Set([
        ...createdIds,
        ...(memberRows ?? []).map((r) => r.campaign_id),
      ])

      setCampaigns([...createdList, ...joined])

      // Discoverable: published, attached to user's groups, not yet joined
      const { data: groupMemberRows } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user!.id)

      const groupIds = (groupMemberRows ?? []).map((r) => r.group_id)

      if (groupIds.length > 0) {
        const { data: discRows } = await supabase
          .from('campaigns')
          .select('*, campaign_groups!inner(group_id)')
          .eq('is_published', true)
          .in('campaign_groups.group_id', groupIds)

        setDiscoverable(
          (discRows ?? [])
            .filter((c) => !allJoinedIds.has(c.id))
            .map((c) => c as unknown as Tables<'campaigns'>),
        )
      }

      setLoading(false)
    }

    load()
  }, [user])

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Campaigns</h2>
          <Button size="sm" onClick={() => navigate('/campaigns/new')}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New
          </Button>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && campaigns.length === 0 && discoverable.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Flame className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
            <p className="text-xs text-muted-foreground">
              Create one or join a group to discover campaigns.
            </p>
          </div>
        )}

        {!loading && campaigns.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Your Campaigns</h3>
            {campaigns.map(({ campaign, current_streak, role }) => (
              <CampaignCard
                key={campaign.id}
                c={campaign}
                streak={current_streak}
                badge={role === 'creator' ? 'Creator' : undefined}
                onClick={() => navigate(`/campaigns/${campaign.id}`)}
              />
            ))}
          </section>
        )}

        {!loading && discoverable.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Discover</h3>
            {discoverable.map((c) => (
              <CampaignCard
                key={c.id}
                c={c}
                onClick={() => navigate(`/campaigns/${c.id}`)}
              />
            ))}
          </section>
        )}
      </div>
    </AppLayout>
  )
}
