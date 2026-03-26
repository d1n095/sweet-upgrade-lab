
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS runtime_trace_id uuid REFERENCES public.runtime_traces(id);
CREATE INDEX IF NOT EXISTS idx_work_items_runtime_trace ON public.work_items(runtime_trace_id) WHERE runtime_trace_id IS NOT NULL;
