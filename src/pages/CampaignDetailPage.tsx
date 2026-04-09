import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Flame, Pencil, PenLine, Users } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import DayCard from '@/components/campaigns/DayCard'
import Leaderboard from '@/components/campaigns/Leaderboard'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import type { Tables } from '@/types/supabase'

type Tab = 'today' | 'leaderboard'

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState<Tables<'campaigns'> | null>(null)
  const [todayDay, setTodayDay] = useState<Tables<'campaign_days'> | null>(null)
  const [member, setMember] = useState<Tables<'campaign_members'> | null>(null)
  const [totalDays, setTotalDays] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const isCreator = campaign?.created_by === user?.id
  const isMember = !!member

  useEffect(() => {
    if (!campaignId || !user) return

    async function load() {
      const { data: camp, error: campErr } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId!)
        .single()

      if (campErr || !camp) {
        setError('Campaign not found.')
        setLoading(false)
        return
      }

      setCampaign(camp)

      // Member stats
      const { data: mem } = await supabase
        .from('campaign_members')
        .select('*')
        .eq('campaign_id', campaignId!)
        .eq('user_id', user!.id)
        .single()

      setMember(mem ?? null)

      // For reading_plan / guided_series: load today's day
      if (camp.type !== 'streak_challenge') {
        const { data: allDays, count } = await supabase
          .from('campaign_days')
          .select('*', { count: 'exact' })
          .eq('campaign_id', campaignId!)
          .order('day_number')

        setTotalDays(count ?? 0)

        if (allDays && allDays.length > 0) {
          // Today's day = last_completed_day + 1, clamped to total
          const nextDayNum = Math.min(
            (mem?.last_completed_day ?? 0) + 1,
            allDays.length,
          )
          setTodayDay(allDays.find((d) => d.day_number === nextDayNum) ?? allDays[0])
        }
      }

      setLoading(false)
    }

    load()
  }, [campaignId, user])

  async function handleJoin() {
    if (!user || !campaignId) return
    setJoining(true)
    const { data, error: err } = await supabase
      .from('campaign_members')
      .insert({ campaign_id: campaignId, user_id: user.id })
      .select()
      .single()
    if (!err && data) setMember(data)
    setJoining(false)
  }

  async function handleLeave() {
    if (!user || !campaignId) return
    setLeaving(true)
    await supabase
      .from('campaign_members')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
    setMember(null)
    setLeaving(false)
  }

  function formatDate(date: string | null) {
    if (!date) return null
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      </AppLayout>
    )
  }

  if (error || !campaign) {
    return (
      <AppLayout>
        <div className="px-4 py-6">
          <p className="text-sm text-destructive">{error ?? 'Campaign not found.'}</p>
          <Link to="/campaigns" className="mt-2 inline-block text-sm text-primary hover:underline">
            Back to campaigns
          </Link>
        </div>
      </AppLayout>
    )
  }

  const progressPercent =
    totalDays > 0
      ? Math.round(((member?.last_completed_day ?? 0) / totalDays) * 100)
      : 0

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          {isCreator && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/campaigns/${campaignId}/edit`)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>

        {/* Campaign header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold">{campaign.title}</h2>
            {!campaign.is_published && (
              <span className="text-xs rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                Draft
              </span>
            )}
          </div>
          {campaign.description && (
            <p className="text-sm text-muted-foreground">{campaign.description}</p>
          )}
          {(campaign.start_date || campaign.end_date) && (
            <p className="text-xs text-muted-foreground">
              {formatDate(campaign.start_date)} – {formatDate(campaign.end_date)}
            </p>
          )}
        </div>

        {/* Streak stats */}
        {isMember && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Current streak</p>
                <p className="text-lg font-bold leading-none">{member.current_streak}</p>
              </div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-xs text-muted-foreground">Longest</p>
              <p className="text-lg font-bold leading-none">{member.longest_streak}</p>
            </div>
            {totalDays > 0 && (
              <>
                <div className="h-8 w-px bg-border" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">
                    {member.last_completed_day}/{totalDays} days
                  </p>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Join / Leave */}
        {!isMember && (
          <Button className="w-full" onClick={handleJoin} disabled={joining}>
            {joining ? 'Joining…' : 'Join Campaign'}
          </Button>
        )}

        {/* Streak challenge CTA */}
        {isMember && campaign.type === 'streak_challenge' && (
          <Button
            className="w-full"
            size="sm"
            onClick={() => navigate(`/write?campaignId=${campaignId}`)}
          >
            <PenLine className="mr-1.5 h-3.5 w-3.5" />
            Write Today's QT
          </Button>
        )}

        {/* Tabs */}
        {isMember && (
          <>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(['today', 'leaderboard'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 rounded-md py-1.5 text-sm transition-colors',
                    tab === t
                      ? 'bg-background font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'today' ? (
                    <span className="capitalize">Today</span>
                  ) : (
                    <span className="flex items-center justify-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      Leaderboard
                    </span>
                  )}
                </button>
              ))}
            </div>

            {tab === 'today' && campaign.type !== 'streak_challenge' && todayDay && (
              <DayCard
                day={todayDay}
                campaignId={campaign.id}
                campaignType={campaign.type}
              />
            )}

            {tab === 'today' && campaign.type !== 'streak_challenge' && !todayDay && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No days scheduled yet.
              </p>
            )}

            {tab === 'leaderboard' && (
              <Leaderboard campaignId={campaign.id} />
            )}
          </>
        )}

        {/* Leave */}
        {isMember && !isCreator && (
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="w-full text-xs text-muted-foreground hover:text-destructive py-2"
          >
            {leaving ? 'Leaving…' : 'Leave campaign'}
          </button>
        )}
      </div>
    </AppLayout>
  )
}
