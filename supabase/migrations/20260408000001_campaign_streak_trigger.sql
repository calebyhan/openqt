-- Trigger function: update campaign_members streak counters when a qualifying
-- qt_entry transitions to published (is_draft = false) and has a campaign_id set.
--
-- Streak rules:
--   reading_plan / guided_series:
--     A qualifying entry has campaign_day IS NOT NULL.
--     current_streak = consecutive day_number run ending at this entry's campaign_day.
--     last_completed_day tracks the highest consecutive day reached.
--
--   streak_challenge:
--     Any published entry counts. Consecutive = submitted on consecutive calendar days
--     (epoch day = floor(extract(epoch from created_at) / 86400)).
--     current_streak increments if epoch_day = last_completed_day + 1 (continuing run)
--     or resets to 1 if epoch_day > last_completed_day + 1 (gap).
--     Same-day entries (epoch_day = last_completed_day) are ignored (idempotent).

CREATE OR REPLACE FUNCTION public.update_campaign_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campaign_type text;
  v_member        record;
  v_epoch_day     int;
  v_new_streak    int;
  v_new_longest   int;
  v_new_last      int;
BEGIN
  -- Only fire when an entry transitions to published (is_draft false)
  -- and is linked to a campaign.
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- On INSERT: only proceed if published
  -- On UPDATE: only proceed if is_draft just became false
  IF TG_OP = 'INSERT' AND NEW.is_draft = true THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT (OLD.is_draft = true AND NEW.is_draft = false) THEN
    RETURN NEW;
  END IF;

  -- Fetch campaign type
  SELECT type INTO v_campaign_type
  FROM public.campaigns
  WHERE id = NEW.campaign_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Ensure the author is a campaign member (auto-join on first qualifying entry)
  INSERT INTO public.campaign_members (campaign_id, user_id)
  VALUES (NEW.campaign_id, NEW.user_id)
  ON CONFLICT (campaign_id, user_id) DO NOTHING;

  -- Fetch current member stats
  SELECT * INTO v_member
  FROM public.campaign_members
  WHERE campaign_id = NEW.campaign_id AND user_id = NEW.user_id;

  IF v_campaign_type IN ('reading_plan', 'guided_series') THEN
    -- Require campaign_day to be set
    IF NEW.campaign_day IS NULL THEN
      RETURN NEW;
    END IF;

    -- Ignore if this day was already counted
    IF NEW.campaign_day <= v_member.last_completed_day THEN
      RETURN NEW;
    END IF;

    -- Check consecutiveness: previous last was campaign_day - 1 (or first entry)
    IF v_member.last_completed_day = 0 OR NEW.campaign_day = v_member.last_completed_day + 1 THEN
      v_new_streak := v_member.current_streak + 1;
    ELSE
      -- Gap detected — reset streak
      v_new_streak := 1;
    END IF;

    v_new_last    := NEW.campaign_day;
    v_new_longest := GREATEST(v_member.longest_streak, v_new_streak);

  ELSE
    -- streak_challenge: epoch-day based
    v_epoch_day := floor(extract(epoch from NEW.created_at) / 86400)::int;

    IF v_epoch_day = v_member.last_completed_day THEN
      -- Same day, already counted
      RETURN NEW;
    ELSIF v_epoch_day = v_member.last_completed_day + 1 THEN
      -- Consecutive day
      v_new_streak := v_member.current_streak + 1;
    ELSE
      -- Gap (or first entry when last_completed_day = 0)
      v_new_streak := 1;
    END IF;

    v_new_last    := v_epoch_day;
    v_new_longest := GREATEST(v_member.longest_streak, v_new_streak);
  END IF;

  UPDATE public.campaign_members
  SET
    current_streak    = v_new_streak,
    longest_streak    = v_new_longest,
    last_completed_day = v_new_last
  WHERE campaign_id = NEW.campaign_id AND user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_campaign_streak
  AFTER INSERT OR UPDATE OF is_draft ON public.qt_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaign_streak();
