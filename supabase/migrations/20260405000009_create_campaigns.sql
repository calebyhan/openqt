CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  -- reading_plan: daily passage per campaign_days row, no prompt
  -- guided_series: daily passage + prompt per campaign_days row
  -- streak_challenge: no campaign_days; write any QT entry every day for the duration
  type text NOT NULL CHECK (type IN ('reading_plan', 'guided_series', 'streak_challenge')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  template_id uuid REFERENCES public.qt_templates(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Only used for reading_plan and guided_series types
CREATE TABLE IF NOT EXISTS public.campaign_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  day_number int NOT NULL,
  title text,
  passage_ref text,
  prompt text,
  notes text,
  UNIQUE (campaign_id, day_number)
);

ALTER TABLE public.campaign_days ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.campaign_groups (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, group_id)
);

ALTER TABLE public.campaign_groups ENABLE ROW LEVEL SECURITY;

-- current_streak, longest_streak, last_completed_day are denormalized for fast leaderboard queries.
-- Update atomically when a qualifying qt_entry is saved (DB trigger or edge function).
-- Do not treat as ground truth for entry history — query qt_entries for that.
CREATE TABLE IF NOT EXISTS public.campaign_members (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  -- reading_plan/guided_series: last campaign day number completed
  -- streak_challenge: epoch day number of last qualifying entry
  last_completed_day int NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, user_id)
);

ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

-- Now that campaigns exists, add the FK on qt_entries.campaign_id
ALTER TABLE public.qt_entries
  ADD CONSTRAINT qt_entries_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;
