# Notifications

OpenQT uses the Web Push API with VAPID for push notifications. All dispatch is handled by the `web-push` Supabase Edge Function.

---

## Notification Types

| Notification | Trigger | Condition |
|---|---|---|
| Daily reminder | Cron (per user's reminder time) | `notif_daily_reminder = true` |
| Streak warning | Cron (8pm user local time) | In active campaign, hasn't completed today, `notif_streak_warning = true` |
| New reaction | DB webhook on `reactions` insert | Entry owner, `notif_reactions = true` |
| New comment | DB webhook on `comments` insert | Entry owner, `notif_comments = true` |
| Campaign day available | Cron (midnight) | In campaign, new day unlocked, `notif_campaign_day = true` |

---

## Implementation

### VAPID Keys

Generate once and store in Supabase secrets:

```bash
npx web-push generate-vapid-keys

supabase secrets set \
  VAPID_PUBLIC_KEY=<public> \
  VAPID_PRIVATE_KEY=<private> \
  VAPID_SUBJECT=mailto:you@example.com
```

`VAPID_PUBLIC_KEY` is also needed client-side to register the push subscription. Expose it via a non-secret env var or a public config endpoint — it is safe to expose publicly.

### Push Subscription Storage

When a user grants notification permission, the browser returns a `PushSubscription` object. Store it verbatim in `profiles.push_subscription` (jsonb). The `web-push` edge function reads this when dispatching.

If a push returns HTTP 410 (Gone), the subscription is expired — delete `profiles.push_subscription` for that user.

### `web-push` Edge Function

Receives a payload:

```ts
{
  user_id: string
  title: string
  body: string
  url?: string   // deep link to open on tap
}
```

Reads `profiles.push_subscription` for the user, sends via VAPID, handles 410 cleanup.

---

## Cron Strategy

`pg_cron` uses static cron expressions and cannot schedule per-user jobs at arbitrary times. The solution is two high-frequency cron jobs that query the database on each tick.

### Daily Reminder (runs every minute)

```sql
-- Pseudocode for the query inside the cron job
SELECT * FROM profiles
WHERE notif_daily_reminder = true
  AND push_subscription IS NOT NULL
  AND (
    -- Convert notif_reminder_time to UTC using the user's timezone
    -- then check if current UTC time falls within this minute
    (now() AT TIME ZONE timezone)::time
      BETWEEN notif_reminder_time - interval '30 seconds'
          AND notif_reminder_time + interval '30 seconds'
  )
```

Dispatch a reminder push for each matched user.

### Streak Warning (runs every minute, relevant window only)

```sql
-- Pseudocode
SELECT cm.user_id FROM campaign_members cm
JOIN campaigns c ON c.id = cm.campaign_id
JOIN profiles p ON p.id = cm.user_id
WHERE c.start_date <= current_date
  AND c.end_date >= current_date
  AND p.notif_streak_warning = true
  AND p.push_subscription IS NOT NULL
  -- It's past 8pm in the user's local timezone
  AND (now() AT TIME ZONE p.timezone)::time >= '20:00'
  -- User hasn't completed today
  AND cm.last_completed_day < <today's day number or epoch day>
  -- Haven't already sent this warning today (add a sent_at tracking column or deduplicate via idempotency)
```

### Campaign Day Available (runs at midnight UTC)

Dispatches to all `campaign_members` where the next `campaign_day` is now available (i.e., `day_number` corresponds to today's date relative to `campaigns.start_date`).

---

## Deduplication

Cron-based notifications must not fire more than once per user per day for the same event. Options:

1. Add a `last_notified_at` column to `campaign_members` (simplest for streak warning).
2. Use a separate `notification_log` table keyed by `(user_id, type, date)` — more general, useful for debugging.

Choose an approach before implementing Phase 6.

---

## `profiles.timezone`

All per-user time calculations depend on `profiles.timezone` being set correctly. It is an IANA timezone string (e.g. `"America/New_York"`, `"Europe/London"`).

- Default is `'UTC'`.
- The Settings page must include a timezone picker so users can set this correctly.
- On first sign-up, attempt to detect timezone from the browser: `Intl.DateTimeFormat().resolvedOptions().timeZone` and pre-fill.
