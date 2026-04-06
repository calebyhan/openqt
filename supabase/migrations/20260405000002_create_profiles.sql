-- profiles extends auth.users
-- Note: default_template_id FK is added in migration 004 (circular FK resolution)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  default_translation text NOT NULL DEFAULT 'NIV',
  timezone text NOT NULL DEFAULT 'UTC',
  push_subscription jsonb,
  notif_daily_reminder boolean NOT NULL DEFAULT true,
  notif_reminder_time time NOT NULL DEFAULT '07:00',
  notif_reactions boolean NOT NULL DEFAULT true,
  notif_comments boolean NOT NULL DEFAULT true,
  notif_campaign_day boolean NOT NULL DEFAULT true,
  notif_streak_warning boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger: auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, timezone)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
