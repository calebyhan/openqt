CREATE TABLE IF NOT EXISTS public.qt_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.qt_templates(id),
  campaign_id uuid, -- FK to campaigns added after campaigns table in migration 009
  campaign_day int,
  title text,
  -- content is keyed by template section key: { [key: string]: string }
  content jsonb NOT NULL DEFAULT '{}',
  -- verse_refs: Array<{ book, chapter, verse, text, translation }>
  verse_refs jsonb,
  is_draft boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qt_entries ENABLE ROW LEVEL SECURITY;
