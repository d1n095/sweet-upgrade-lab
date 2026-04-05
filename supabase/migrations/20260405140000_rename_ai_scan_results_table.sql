-- Rename ai_scan_results table to scan_results
-- Removes AI-prefixed table name; this table stores generic scan result scores.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_scan_results') THEN
    ALTER TABLE public.ai_scan_results RENAME TO scan_results;
  END IF;
END $$;
