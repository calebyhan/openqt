import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Tables } from '@/types/supabase'

type Profile = Tables<'profiles'>

// Common IANA timezones for the picker
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Asia/Jerusalem',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
]

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data)
        setLoading(false)
      })
  }, [user])

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!user || !profile) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    const { error } = await supabase
      .from('profiles')
      .update({
        timezone: profile.timezone,
        notif_daily_reminder: profile.notif_daily_reminder,
        notif_reminder_time: profile.notif_reminder_time,
        notif_reactions: profile.notif_reactions,
        notif_comments: profile.notif_comments,
        notif_campaign_day: profile.notif_campaign_day,
        notif_streak_warning: profile.notif_streak_warning,
      })
      .eq('id', user.id)
    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-8 max-w-lg">
        <h2 className="text-xl font-semibold">Settings</h2>

        {/* Templates */}
        <section className="space-y-1">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Templates
          </h3>
          <Link
            to="/settings/templates"
            className="flex items-center justify-between rounded-md border px-4 py-3 text-sm hover:bg-muted"
          >
            Custom Templates
            <span className="text-muted-foreground">›</span>
          </Link>
        </section>

        {profile && (
          <>
            {/* Timezone */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Timezone
              </h3>
              <div className="flex items-center gap-3">
                <select
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                  value={profile.timezone}
                  onChange={(e) => update('timezone', e.target.value)}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
                <button
                  className="text-xs text-primary hover:underline whitespace-nowrap"
                  onClick={() => {
                    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
                    if (detected) update('timezone', detected)
                  }}
                >
                  Use browser timezone
                </button>
              </div>
            </section>

            {/* Notifications */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Notifications
              </h3>

              <Toggle
                label="Daily reminder"
                description="A daily nudge to complete your quiet time"
                checked={profile.notif_daily_reminder}
                onChange={(v) => update('notif_daily_reminder', v)}
              />

              {profile.notif_daily_reminder && (
                <div className="ml-4 flex items-center gap-3 text-sm">
                  <label htmlFor="reminder-time" className="text-muted-foreground">
                    Reminder time
                  </label>
                  <input
                    id="reminder-time"
                    type="time"
                    className="rounded-md border bg-background px-2 py-1 text-sm"
                    value={profile.notif_reminder_time}
                    onChange={(e) => update('notif_reminder_time', e.target.value)}
                  />
                </div>
              )}

              <Toggle
                label="Streak warnings"
                description="Alert at 8pm if you haven't completed today's campaign"
                checked={profile.notif_streak_warning}
                onChange={(v) => update('notif_streak_warning', v)}
              />

              <Toggle
                label="Campaign day available"
                description="Notify when a new campaign day unlocks"
                checked={profile.notif_campaign_day}
                onChange={(v) => update('notif_campaign_day', v)}
              />

              <Toggle
                label="Reactions"
                description="When someone reacts to your entry"
                checked={profile.notif_reactions}
                onChange={(v) => update('notif_reactions', v)}
              />

              <Toggle
                label="Comments"
                description="When someone comments on your entry"
                checked={profile.notif_comments}
                onChange={(v) => update('notif_comments', v)}
              />
            </section>

            {/* Save */}
            <div className="flex items-center gap-3">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
              {saved && <span className="text-sm text-muted-foreground">Saved</span>}
              {saveError && <span className="text-sm text-destructive">{saveError}</span>}
            </div>
          </>
        )}

        {/* Sign out */}
        <button
          onClick={() => void handleSignOut()}
          className="w-full rounded-md border border-destructive px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5"
        >
          Sign out
        </button>
      </div>
    </AppLayout>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}
