ALTER TABLE public.ai_read_log
  ADD COLUMN file_paths text[] DEFAULT '{}',
  ADD COLUMN endpoints text[] DEFAULT '{}',
  ADD COLUMN linked_bug_id uuid,
  ADD COLUMN linked_work_item_id text,
  ADD COLUMN linked_scan_id uuid;