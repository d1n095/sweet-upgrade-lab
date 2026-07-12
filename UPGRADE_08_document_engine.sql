-- =====================================================================
-- MY MONEY MASTER — UPGRADE 08: DOKUMENT-MOTOR (ADR-006)
-- =====================================================================
-- Stödjer generell dokument-import: fil-hash (dubblettskydd), rå OCR-resultat.
-- Additivt, idempotent.
-- =====================================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS content_hash TEXT,     -- SHA-256 av filen (dubblettskydd)
  ADD COLUMN IF NOT EXISTS ocr_result JSONB;       -- strukturerat OCR-resultat per typ

-- Samma fil (hash) får bara importeras en gång per kontext.
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_hash
  ON public.documents(owner_context_id, content_hash)
  WHERE content_hash IS NOT NULL AND deleted_at IS NULL;

-- import_batches: säkerställ owner_context_id finns (kan ha skapats i UPGRADE_04-svit)
ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_import_batches_ctx
  ON public.import_batches(owner_context_id, created_at DESC);

-- =====================================================================
-- KLART. Dokument bär nu content_hash (fil-dubblettskydd) + ocr_result.
-- =====================================================================
