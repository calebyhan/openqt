-- DB triggers: notify entry owner when someone reacts or comments

-- Trigger: new reaction
CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner     uuid;
  v_notif_on  boolean;
  v_push_sub  jsonb;
  v_reactor   text;
BEGIN
  -- Resolve entry owner
  SELECT user_id INTO v_owner FROM public.qt_entries WHERE id = NEW.qt_entry_id;
  -- No self-notifications
  IF v_owner = NEW.user_id THEN RETURN NEW; END IF;
  -- Check preference + subscription
  SELECT notif_reactions, push_subscription
    INTO v_notif_on, v_push_sub
    FROM public.profiles WHERE id = v_owner;
  IF NOT v_notif_on OR v_push_sub IS NULL THEN RETURN NEW; END IF;
  -- Reactor's display name
  SELECT display_name INTO v_reactor FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.send_push_notification(
    v_owner,
    'New reaction',
    COALESCE(v_reactor, 'Someone') || ' reacted ' || NEW.emoji || ' to your QT entry',
    '/entries/' || NEW.qt_entry_id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_reaction
  AFTER INSERT ON public.reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();

-- Trigger: new comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner     uuid;
  v_notif_on  boolean;
  v_push_sub  jsonb;
  v_commenter text;
BEGIN
  SELECT user_id INTO v_owner FROM public.qt_entries WHERE id = NEW.qt_entry_id;
  IF v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT notif_comments, push_subscription
    INTO v_notif_on, v_push_sub
    FROM public.profiles WHERE id = v_owner;
  IF NOT v_notif_on OR v_push_sub IS NULL THEN RETURN NEW; END IF;
  SELECT display_name INTO v_commenter FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.send_push_notification(
    v_owner,
    'New comment',
    COALESCE(v_commenter, 'Someone') || ' commented on your QT entry',
    '/entries/' || NEW.qt_entry_id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();
