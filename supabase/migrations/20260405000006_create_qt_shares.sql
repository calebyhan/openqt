CREATE TABLE IF NOT EXISTS public.qt_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qt_entry_id uuid NOT NULL REFERENCES public.qt_entries(id) ON DELETE CASCADE,
  group_id uuid NOT NULL, -- FK to groups added in migration 008
  visibility text NOT NULL CHECK (visibility IN ('reactions_only', 'comments', 'full')),
  shared_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qt_shares ENABLE ROW LEVEL SECURITY;
