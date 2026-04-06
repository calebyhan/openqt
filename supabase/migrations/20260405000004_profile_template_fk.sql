-- Resolve circular FK: profiles → qt_templates (added after both tables exist)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_template_id uuid REFERENCES public.qt_templates(id) ON DELETE SET NULL;
