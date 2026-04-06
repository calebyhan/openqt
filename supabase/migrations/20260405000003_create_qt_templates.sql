-- sections shape: Array<{ key: string, label: string, type: 'text' | 'verse_picker' | 'rich_text', placeholder?: string, required?: boolean }>
CREATE TABLE IF NOT EXISTS public.qt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sections jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qt_templates ENABLE ROW LEVEL SECURITY;
