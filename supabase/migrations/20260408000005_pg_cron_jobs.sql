-- pg_cron scheduled notification jobs
-- Requires pg_cron extension (enabled via Supabase dashboard → Database → Extensions → pg_cron).
-- On local dev: run `ALTER SYSTEM SET cron.database_name = 'postgres'; SELECT pg_reload_conf();`
-- after enabling the extension, then the schedules below will work.

-- ─── Helper: dispatch daily reminders ────────────────────────────────────────
-- Called every minute; sends a push to users whose reminder time matches "now"
-- (within a 30-second window) and haven't already received one today.
CREATE OR REPLACE FUNCTION public.dispatch_daily_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id AS user_id, p.display_name
      FROM public.profiles p
     WHERE p.notif_daily_reminder = true
       AND p.push_subscription IS NOT NULL
       -- Current time in the user's timezone falls within 30 s of their reminder time
       AND (now() AT TIME ZONE p.timezone)::time
           BETWEEN p.notif_reminder_time - interval '30 seconds'
               AND p.notif_reminder_time + interval '30 seconds'
       -- Deduplicate: skip if already sent today
       AND NOT EXISTS (
         SELECT 1 FROM public.notification_log nl
          WHERE nl.user_id = p.id
            AND nl.type = 'daily_reminder'
            AND nl.ref_date = (now() AT TIME ZONE p.timezone)::date
       )
  LOOP
    PERFORM public.send_push_notification(
      r.user_id,
      'Time for your QT',
      'Your daily quiet time reminder',
      '/write'
    );
    INSERT INTO public.notification_log (user_id, type, ref_date)
      VALUES (r.user_id, 'daily_reminder', (now() AT TIME ZONE
        (SELECT timezone FROM public.profiles WHERE id = r.user_id))::date)
      ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ─── Helper: dispatch streak warnings ────────────────────────────────────────
-- Called every minute; warns users at/after 8pm local time if they're in an
-- active campaign and haven't completed today.
CREATE OR REPLACE FUNCTION public.dispatch_streak_warnings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT p.id AS user_id
      FROM public.campaign_members cm
      JOIN public.campaigns c    ON c.id = cm.campaign_id
      JOIN public.profiles  p    ON p.id = cm.user_id
     WHERE c.start_date <= current_date
       AND c.end_date   >= current_date
       AND p.notif_streak_warning = true
       AND p.push_subscription   IS NOT NULL
       -- It's past 8pm in the user's local timezone
       AND (now() AT TIME ZONE p.timezone)::time >= '20:00'
       -- User hasn't completed today
       AND (
         -- streak_challenge: epoch-day check
         (c.type = 'streak_challenge'
          AND cm.last_completed_day < floor(extract(epoch from (now() AT TIME ZONE p.timezone)) / 86400)::int)
         OR
         -- reading_plan / guided_series: day-number check
         (c.type IN ('reading_plan', 'guided_series')
          AND cm.last_completed_day < (current_date - c.start_date + 1))
       )
       -- Deduplicate
       AND NOT EXISTS (
         SELECT 1 FROM public.notification_log nl
          WHERE nl.user_id = p.id
            AND nl.type = 'streak_warning'
            AND nl.ref_date = (now() AT TIME ZONE p.timezone)::date
       )
  LOOP
    PERFORM public.send_push_notification(
      r.user_id,
      'Streak at risk!',
      'Complete your QT today to keep your streak alive',
      '/write'
    );
    INSERT INTO public.notification_log (user_id, type, ref_date)
      VALUES (r.user_id, 'streak_warning', (now() AT TIME ZONE
        (SELECT timezone FROM public.profiles WHERE id = r.user_id))::date)
      ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ─── Helper: dispatch campaign-day-available notifications ───────────────────
-- Called daily at midnight UTC; notifies members when their next campaign day
-- becomes available (i.e., day_number = days elapsed since start_date + 1).
CREATE OR REPLACE FUNCTION public.dispatch_campaign_day_available()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT cm.user_id,
                    cd.title      AS day_title,
                    cd.passage_ref,
                    c.id          AS campaign_id,
                    cd.day_number
      FROM public.campaign_members cm
      JOIN public.campaigns     c  ON c.id = cm.campaign_id
      JOIN public.campaign_days cd ON cd.campaign_id = c.id
      JOIN public.profiles      p  ON p.id = cm.user_id
     WHERE c.type IN ('reading_plan', 'guided_series')
       AND c.start_date <= current_date
       AND c.end_date   >= current_date
       AND p.notif_campaign_day  = true
       AND p.push_subscription   IS NOT NULL
       -- This day just became available today
       AND cd.day_number = (current_date - c.start_date + 1)
       -- Deduplicate
       AND NOT EXISTS (
         SELECT 1 FROM public.notification_log nl
          WHERE nl.user_id = cm.user_id
            AND nl.type = 'campaign_day'
            AND nl.ref_date = current_date
       )
  LOOP
    PERFORM public.send_push_notification(
      r.user_id,
      'New campaign day available',
      COALESCE(r.day_title, 'Day ' || r.day_number)
        || CASE WHEN r.passage_ref IS NOT NULL THEN ' — ' || r.passage_ref ELSE '' END,
      '/campaigns/' || r.campaign_id::text
    );
    INSERT INTO public.notification_log (user_id, type, ref_date)
      VALUES (r.user_id, 'campaign_day', current_date)
      ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ─── Schedule cron jobs ───────────────────────────────────────────────────────
-- These statements are wrapped in a DO block so that the migration does not fail
-- if pg_cron is not yet enabled (e.g., during a fresh local db reset before
-- the extension is turned on in the dashboard). Enable pg_cron first, then run
-- `supabase db reset` (or execute the SELECT cron.schedule lines manually).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Daily reminder: every minute
    PERFORM cron.schedule(
      'openqt-daily-reminders',
      '* * * * *',
      'SELECT public.dispatch_daily_reminders()'
    );
    -- Streak warning: every minute (function guards for 8pm window internally)
    PERFORM cron.schedule(
      'openqt-streak-warnings',
      '* * * * *',
      'SELECT public.dispatch_streak_warnings()'
    );
    -- Campaign day available: once daily at midnight UTC
    PERFORM cron.schedule(
      'openqt-campaign-day',
      '0 0 * * *',
      'SELECT public.dispatch_campaign_day_available()'
    );
  END IF;
END;
$$;
