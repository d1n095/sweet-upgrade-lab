-- Rename ai_pre_verify_* columns in work_items to remove the ai_ prefix
ALTER TABLE work_items
  RENAME COLUMN ai_pre_verify_status TO pre_verify_status;
ALTER TABLE work_items
  RENAME COLUMN ai_pre_verify_result TO pre_verify_result;
ALTER TABLE work_items
  RENAME COLUMN ai_pre_verify_at TO pre_verify_at;
