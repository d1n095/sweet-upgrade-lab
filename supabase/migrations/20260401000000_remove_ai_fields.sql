-- Remove AI fields from bug_reports
ALTER TABLE bug_reports
  DROP COLUMN IF EXISTS ai_summary,
  DROP COLUMN IF EXISTS ai_category,
  DROP COLUMN IF EXISTS ai_severity,
  DROP COLUMN IF EXISTS ai_tags,
  DROP COLUMN IF EXISTS ai_clean_prompt,
  DROP COLUMN IF EXISTS ai_repro_steps,
  DROP COLUMN IF EXISTS ai_processed_at,
  DROP COLUMN IF EXISTS ai_approved,
  DROP COLUMN IF EXISTS ai_actionable_fix;

-- Remove AI fields from work_items
ALTER TABLE work_items
  DROP COLUMN IF EXISTS ai_assigned,
  DROP COLUMN IF EXISTS ai_category,
  DROP COLUMN IF EXISTS ai_confidence,
  DROP COLUMN IF EXISTS ai_detected,
  DROP COLUMN IF EXISTS ai_overrides,
  DROP COLUMN IF EXISTS ai_pre_verify_at,
  DROP COLUMN IF EXISTS ai_pre_verify_result,
  DROP COLUMN IF EXISTS ai_pre_verify_status,
  DROP COLUMN IF EXISTS ai_resolution_notes,
  DROP COLUMN IF EXISTS ai_review_at,
  DROP COLUMN IF EXISTS ai_review_result,
  DROP COLUMN IF EXISTS ai_review_status,
  DROP COLUMN IF EXISTS ai_root_causes,
  DROP COLUMN IF EXISTS ai_type_classification,
  DROP COLUMN IF EXISTS ai_type_reason;

-- Drop AI-only tables
DROP TABLE IF EXISTS ai_scan_results;
DROP TABLE IF EXISTS ai_read_log;
DROP TABLE IF EXISTS ai_chat_messages;
