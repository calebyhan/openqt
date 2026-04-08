-- Add unique constraint to qt_shares so upsert on (qt_entry_id, group_id) works
ALTER TABLE public.qt_shares
  ADD CONSTRAINT qt_shares_entry_group_unique UNIQUE (qt_entry_id, group_id);
