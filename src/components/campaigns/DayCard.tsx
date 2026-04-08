/**
 * DayCard — Shows today's campaign day (passage + prompt + CTA).
 * Used in CampaignDetailPage for reading_plan and guided_series campaigns.
 */
import { useNavigate } from 'react-router-dom'
import { BookOpen, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Tables } from '@/types/supabase'

interface Props {
  day: Tables<'campaign_days'>
  campaignId: string
  campaignType: string
}

export default function DayCard({ day, campaignId, campaignType }: Props) {
  const navigate = useNavigate()

  function handleStart() {
    navigate(
      `/write?campaignId=${campaignId}&day=${day.day_number}`,
    )
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
        <BookOpen className="h-3.5 w-3.5" />
        Day {day.day_number}
        {day.title && (
          <>
            <span className="text-border">·</span>
            <span className="normal-case text-foreground font-medium">{day.title}</span>
          </>
        )}
      </div>

      {day.passage_ref && (
        <p className="text-sm font-semibold">{day.passage_ref}</p>
      )}

      {campaignType === 'guided_series' && day.prompt && (
        <div className="rounded-md bg-muted px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Prompt</p>
          <p className="text-sm">{day.prompt}</p>
        </div>
      )}

      {day.notes && (
        <p className="text-xs text-muted-foreground">{day.notes}</p>
      )}

      <Button className="w-full" size="sm" onClick={handleStart}>
        <PenLine className="mr-1.5 h-3.5 w-3.5" />
        Start Today's QT
      </Button>
    </div>
  )
}
