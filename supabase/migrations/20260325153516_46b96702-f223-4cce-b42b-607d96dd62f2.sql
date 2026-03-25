ALTER TABLE public.scan_dismissals 
ADD COLUMN IF NOT EXISTS dismissed_severity text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS escalation_note text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS escalated_at timestamptz DEFAULT NULL;