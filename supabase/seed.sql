-- Seed built-in system templates
-- These are inserted with is_system = true and created_by = null

INSERT INTO public.qt_templates (name, description, is_system, created_by, sections)
VALUES
  (
    'SOAP',
    'Scripture, Observation, Application, Prayer — a classic quiet time format.',
    true,
    null,
    '[
      {"key": "scripture", "label": "Scripture", "type": "verse_picker", "placeholder": "Select a verse or passage", "required": true},
      {"key": "observation", "label": "Observation", "type": "rich_text", "placeholder": "What does this passage say? What stands out to you?", "required": false},
      {"key": "application", "label": "Application", "type": "rich_text", "placeholder": "How does this apply to your life today?", "required": false},
      {"key": "prayer", "label": "Prayer", "type": "rich_text", "placeholder": "Write a prayer in response to what you read.", "required": false}
    ]'::jsonb
  ),
  (
    'Free-form',
    'A blank canvas for your quiet time thoughts.',
    true,
    null,
    '[
      {"key": "title", "label": "Title", "type": "text", "placeholder": "Give your entry a title", "required": false},
      {"key": "entry", "label": "Entry", "type": "rich_text", "placeholder": "Write freely…", "required": true}
    ]'::jsonb
  ),
  (
    'Simple Journal',
    'Passage and reflection — short and simple.',
    true,
    null,
    '[
      {"key": "passage", "label": "Passage", "type": "verse_picker", "placeholder": "Select a passage", "required": false},
      {"key": "reflection", "label": "Reflection", "type": "rich_text", "placeholder": "What is God saying to you through this passage?", "required": true}
    ]'::jsonb
  )
ON CONFLICT DO NOTHING;
