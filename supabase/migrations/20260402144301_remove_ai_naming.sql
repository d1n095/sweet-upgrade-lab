-- Remove AI naming from tables and columns

-- Rename tables
ALTER TABLE public.ai_scan_results RENAME TO scan_results;
ALTER TABLE public.ai_read_log RENAME TO read_log;
ALTER TABLE public.ai_chat_messages RENAME TO chat_messages;

-- Rename column in read_log (was ai_read_log.ai_suggestion)
ALTER TABLE public.read_log RENAME COLUMN ai_suggestion TO suggestion;

-- Rename bug_reports.ai_summary → summary
ALTER TABLE public.bug_reports RENAME COLUMN ai_summary TO summary;

-- Rename remaining ai_* columns in bug_reports
ALTER TABLE public.bug_reports RENAME COLUMN ai_actionable_fix TO actionable_fix;
ALTER TABLE public.bug_reports RENAME COLUMN ai_approved TO scan_approved;
ALTER TABLE public.bug_reports RENAME COLUMN ai_category TO category;
ALTER TABLE public.bug_reports RENAME COLUMN ai_clean_prompt TO clean_prompt;
ALTER TABLE public.bug_reports RENAME COLUMN ai_processed_at TO processed_at;
ALTER TABLE public.bug_reports RENAME COLUMN ai_repro_steps TO repro_steps;
ALTER TABLE public.bug_reports RENAME COLUMN ai_severity TO severity;
ALTER TABLE public.bug_reports RENAME COLUMN ai_tags TO tags;

-- Rename ai_* columns in work_items
ALTER TABLE public.work_items RENAME COLUMN ai_assigned TO scan_assigned;
ALTER TABLE public.work_items RENAME COLUMN ai_category TO category;
ALTER TABLE public.work_items RENAME COLUMN ai_confidence TO confidence;
ALTER TABLE public.work_items RENAME COLUMN ai_detected TO scan_detected;
ALTER TABLE public.work_items RENAME COLUMN ai_overrides TO overrides;
ALTER TABLE public.work_items RENAME COLUMN ai_pre_verify_at TO pre_verify_at;
ALTER TABLE public.work_items RENAME COLUMN ai_pre_verify_result TO pre_verify_result;
ALTER TABLE public.work_items RENAME COLUMN ai_pre_verify_status TO pre_verify_status;
ALTER TABLE public.work_items RENAME COLUMN ai_resolution_notes TO scan_notes;
ALTER TABLE public.work_items RENAME COLUMN ai_review_at TO review_at;
ALTER TABLE public.work_items RENAME COLUMN ai_review_result TO review_result;
ALTER TABLE public.work_items RENAME COLUMN ai_review_status TO review_status;
ALTER TABLE public.work_items RENAME COLUMN ai_root_causes TO root_causes;
ALTER TABLE public.work_items RENAME COLUMN ai_type_classification TO type_classification;
ALTER TABLE public.work_items RENAME COLUMN ai_type_reason TO type_reason;

-- Rename ai_* columns in system_history
ALTER TABLE public.system_history RENAME COLUMN ai_review_at TO review_at;
ALTER TABLE public.system_history RENAME COLUMN ai_review_result TO review_result;
ALTER TABLE public.system_history RENAME COLUMN ai_review_status TO review_status;

-- Backfill source_type values that used "ai_scan", "ai_detection", "ai_visual_qa", "ai_chat"
UPDATE public.work_items SET source_type = 'scan'      WHERE source_type = 'ai_scan';
UPDATE public.work_items SET source_type = 'detection' WHERE source_type = 'ai_detection';
UPDATE public.work_items SET source_type = 'visual_qa' WHERE source_type = 'ai_visual_qa';
UPDATE public.work_items SET source_type = 'chat'      WHERE source_type = 'ai_chat';
