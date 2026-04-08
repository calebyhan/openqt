/**
 * CampaignCreator — 4-step wizard for creating or editing a campaign.
 *
 * Step 1: Metadata (title, description, type, template, start/end dates)
 * Step 2: Days (inline table editor — skipped for streak_challenge)
 * Step 3: Attach to groups (owner/admin groups only)
 * Step 4: Review + publish or save as draft
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import type { Tables } from '@/types/supabase'

type CampaignType = 'reading_plan' | 'guided_series' | 'streak_challenge'

interface DayRow {
  day_number: number
  title: string
  passage_ref: string
  prompt: string
  notes: string
}

interface GroupChoice {
  group: Tables<'groups'>
  checked: boolean
}

interface Props {
  /** When provided, loads this campaign for editing */
  campaignId?: string
}

const STEP_LABELS = ['Details', 'Days', 'Groups', 'Review']

const TYPE_OPTIONS: { value: CampaignType; label: string; description: string }[] = [
  { value: 'reading_plan', label: 'Reading Plan', description: 'Assign a passage per day' },
  { value: 'guided_series', label: 'Guided Series', description: 'Passage + writing prompt per day' },
  { value: 'streak_challenge', label: 'Streak Challenge', description: 'Write any QT entry every day' },
]

function emptyDay(dayNumber: number): DayRow {
  return { day_number: dayNumber, title: '', passage_ref: '', prompt: '', notes: '' }
}

export default function CampaignCreator({ campaignId }: Props) {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0) // 0-3

  // ── Step 1: metadata ────────────────────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<CampaignType>('reading_plan')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [templates, setTemplates] = useState<Tables<'qt_templates'>[]>([])
  const [templateId, setTemplateId] = useState<string>('')

  // ── Step 2: days ─────────────────────────────────────────────────────────────
  const [days, setDays] = useState<DayRow[]>([emptyDay(1)])

  // ── Step 3: groups ───────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<GroupChoice[]>([])

  // ── Saving ───────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Load templates ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('qt_templates')
      .select('*')
      .then(({ data }) => {
        setTemplates(data ?? [])
        if (data && data.length > 0 && !templateId) {
          setTemplateId(data[0].id)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load groups the user can administer ──────────────────────────────────────
  useEffect(() => {
    if (!user) return
    supabase
      .from('group_members')
      .select('role, groups(id, name, description, invite_code, created_by, created_at)')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .then(({ data }) => {
        setGroups(
          (data ?? [])
            .filter((r) => r.groups)
            .map((r) => ({ group: r.groups as unknown as Tables<'groups'>, checked: false })),
        )
      })
  }, [user])

  // ── Load existing campaign for edit mode ─────────────────────────────────────
  useEffect(() => {
    if (!campaignId) return

    async function load() {
      const { data: camp } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId!)
        .single()
      if (!camp) return

      setTitle(camp.title)
      setDescription(camp.description ?? '')
      setType(camp.type as CampaignType)
      setStartDate(camp.start_date ?? '')
      setEndDate(camp.end_date ?? '')
      setTemplateId(camp.template_id ?? '')

      const { data: dayRows } = await supabase
        .from('campaign_days')
        .select('*')
        .eq('campaign_id', campaignId!)
        .order('day_number')

      if (dayRows && dayRows.length > 0) {
        setDays(
          dayRows.map((d) => ({
            day_number: d.day_number,
            title: d.title ?? '',
            passage_ref: d.passage_ref ?? '',
            prompt: d.prompt ?? '',
            notes: d.notes ?? '',
          })),
        )
      }

      const { data: cgRows } = await supabase
        .from('campaign_groups')
        .select('group_id')
        .eq('campaign_id', campaignId!)

      const attachedIds = new Set((cgRows ?? []).map((r) => r.group_id))
      setGroups((prev) =>
        prev.map((g) => ({ ...g, checked: attachedIds.has(g.group.id) })),
      )
    }

    load()
  }, [campaignId])

  // ── Day editing helpers ───────────────────────────────────────────────────────
  function updateDay(idx: number, field: keyof DayRow, value: string) {
    setDays((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)),
    )
  }

  function addDay() {
    setDays((prev) => [...prev, emptyDay(prev.length + 1)])
  }

  function removeDay(idx: number) {
    setDays((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((d, i) => ({ ...d, day_number: i + 1 })),
    )
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  function nextStep() {
    setError(null)
    // Skip Days step for streak_challenge
    if (step === 0 && type === 'streak_challenge') {
      setStep(2)
    } else {
      setStep((s) => Math.min(s + 1, 3))
    }
  }

  function prevStep() {
    if (step === 2 && type === 'streak_challenge') {
      setStep(0)
    } else {
      setStep((s) => Math.max(s - 1, 0))
    }
  }

  function step1Valid() {
    return title.trim().length > 0
  }

  function step2Valid() {
    if (type === 'streak_challenge') return true
    return days.length > 0 && days.every((d) => d.day_number > 0)
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave(publish: boolean) {
    if (!user) return
    setSaving(true)
    setError(null)

    try {
      let finalCampaignId = campaignId

      if (campaignId) {
        // Update existing
        const { error: updErr } = await supabase
          .from('campaigns')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            type,
            template_id: templateId || null,
            start_date: startDate || null,
            end_date: endDate || null,
            is_published: publish,
          })
          .eq('id', campaignId)
        if (updErr) throw updErr
      } else {
        // Create new
        const { data: newCamp, error: insErr } = await supabase
          .from('campaigns')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            type,
            created_by: user.id,
            template_id: templateId || null,
            start_date: startDate || null,
            end_date: endDate || null,
            is_published: publish,
          })
          .select('id')
          .single()
        if (insErr || !newCamp) throw insErr ?? new Error('Failed to create campaign')
        finalCampaignId = newCamp.id
      }

      // Upsert days (skip for streak_challenge)
      if (type !== 'streak_challenge' && finalCampaignId) {
        // Delete removed days on edit
        if (campaignId) {
          await supabase
            .from('campaign_days')
            .delete()
            .eq('campaign_id', finalCampaignId)
            .not('day_number', 'in', `(${days.map((d) => d.day_number).join(',')})`)
        }
        const dayRows = days.map((d) => ({
          campaign_id: finalCampaignId!,
          day_number: d.day_number,
          title: d.title || null,
          passage_ref: d.passage_ref || null,
          prompt: d.prompt || null,
          notes: d.notes || null,
        }))
        const { error: dayErr } = await supabase
          .from('campaign_days')
          .upsert(dayRows, { onConflict: 'campaign_id,day_number' })
        if (dayErr) throw dayErr
      }

      // Sync group attachments
      if (finalCampaignId) {
        const checkedIds = groups.filter((g) => g.checked).map((g) => g.group.id)

        if (campaignId) {
          // Delete detached groups
          const detachIds = groups.filter((g) => !g.checked).map((g) => g.group.id)
          if (detachIds.length > 0) {
            await supabase
              .from('campaign_groups')
              .delete()
              .eq('campaign_id', finalCampaignId)
              .in('group_id', detachIds)
          }
        }

        if (checkedIds.length > 0) {
          const { error: cgErr } = await supabase
            .from('campaign_groups')
            .upsert(
              checkedIds.map((gid) => ({ campaign_id: finalCampaignId!, group_id: gid })),
              { onConflict: 'campaign_id,group_id' },
            )
          if (cgErr) throw cgErr
        }
      }

      navigate(`/campaigns/${finalCampaignId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────────
  const visibleSteps = type === 'streak_challenge'
    ? ['Details', 'Groups', 'Review']
    : STEP_LABELS

  // Map logical step (0-3) to display index for the indicator
  const displayStep = type === 'streak_challenge' && step >= 2 ? step - 1 : step

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {visibleSteps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                i === displayStep
                  ? 'bg-primary text-primary-foreground'
                  : i < displayStep
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                'text-sm',
                i === displayStep ? 'font-medium' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
            {i < visibleSteps.length - 1 && (
              <div className="mx-1 h-px w-6 bg-border" />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Details ── */}
      {step === 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Campaign Details</h3>

          <div className="space-y-1">
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 30-Day Psalms Journey"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this campaign about?"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Type</label>
            <div className="space-y-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition-colors',
                    type === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Default Template</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">None</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Days (reading_plan / guided_series only) ── */}
      {step === 1 && type !== 'streak_challenge' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Daily Schedule</h3>
            <Button variant="outline" size="sm" onClick={addDay}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Day
            </Button>
          </div>

          <div className="space-y-3">
            {days.map((d, i) => (
              <div key={d.day_number} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Day {d.day_number}</span>
                  {days.length > 1 && (
                    <button
                      onClick={() => removeDay(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Input
                  placeholder="Title (optional)"
                  value={d.title}
                  onChange={(e) => updateDay(i, 'title', e.target.value)}
                />
                <Input
                  placeholder="Passage (e.g. John 3:16-21)"
                  value={d.passage_ref}
                  onChange={(e) => updateDay(i, 'passage_ref', e.target.value)}
                />
                {type === 'guided_series' && (
                  <Input
                    placeholder="Writing prompt (optional)"
                    value={d.prompt}
                    onChange={(e) => updateDay(i, 'prompt', e.target.value)}
                  />
                )}
                <Input
                  placeholder="Notes (optional)"
                  value={d.notes}
                  onChange={(e) => updateDay(i, 'notes', e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Groups ── */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Attach to Groups</h3>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don't own or admin any groups yet.
            </p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <button
                  key={g.group.id}
                  onClick={() =>
                    setGroups((prev) =>
                      prev.map((x) =>
                        x.group.id === g.group.id ? { ...x, checked: !x.checked } : x,
                      ),
                    )
                  }
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors',
                    g.checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">{g.group.name}</p>
                    {g.group.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {g.group.description}
                      </p>
                    )}
                  </div>
                  <div
                    className={cn(
                      'h-4 w-4 rounded border',
                      g.checked ? 'border-primary bg-primary' : 'border-input',
                    )}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Review ── */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Review & Publish</h3>

          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Title</span>
              <span className="font-medium">{title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">{type.replace(/_/g, ' ')}</span>
            </div>
            {type !== 'streak_challenge' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Days</span>
                <span className="font-medium">{days.length}</span>
              </div>
            )}
            {(startDate || endDate) && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dates</span>
                <span className="font-medium">
                  {startDate || '—'} → {endDate || '—'}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Groups</span>
              <span className="font-medium">
                {groups.filter((g) => g.checked).length || 'None'}
              </span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2">
            <Button onClick={() => handleSave(true)} disabled={saving}>
              {saving ? 'Publishing…' : 'Publish Campaign'}
            </Button>
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? 'Saving…' : 'Save as Draft'}
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={prevStep}
          disabled={step === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        {step < 3 && (
          <Button
            size="sm"
            onClick={nextStep}
            disabled={step === 0 ? !step1Valid() : step === 1 ? !step2Valid() : false}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
