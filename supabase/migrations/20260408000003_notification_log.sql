-- Enable pg_net for HTTP calls from triggers/functions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- notification_log: deduplicates cron-based notifications (one per user per type per day)
CREATE TABLE IF NOT EXISTS public.notification_log (
  id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type     text        NOT NULL,   -- 'daily_reminder' | 'streak_warning' | 'campaign_day' | 'reaction' | 'comment'
  ref_date date        NOT NULL DEFAULT current_date,
  sent_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, type, ref_date)
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification log"
  ON public.notification_log FOR SELECT
  USING (auth.uid() = user_id);

-- Helper: call the web-push edge function for a user.
-- Reads SUPABASE_URL and SERVICE_ROLE_KEY from database settings so that
-- per-environment values can be injected without code changes.
--
-- Local dev: run once after `supabase db reset`:
--   ALTER DATABASE postgres
--     SET "app.edge_base_url"    TO 'http://127.0.0.1:54321';
--   ALTER DATABASE postgres
--     SET "app.service_role_key" TO '<local service_role JWT>';
--
-- Production: set via Supabase dashboard → Database → Settings → Config, or Vault.
CREATE OR REPLACE FUNCTION public.send_push_notification(
  p_user_id uuid,
  p_title   text,
  p_body    text,
  p_url     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_url  text;
  v_svc_key   text;
BEGIN
  v_base_url := current_setting('app.edge_base_url',    true);
  v_svc_key  := current_setting('app.service_role_key', true);

  -- Silently skip if configuration is not set (e.g. during local migration runs)
  IF v_base_url IS NULL OR v_svc_key IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_base_url || '/functions/v1/web-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_svc_key
    ),
    body    := jsonb_build_object(
      'user_id', p_user_id,
      'title',   p_title,
      'body',    p_body,
      'url',     p_url
    )::text
  );
END;
$$;
