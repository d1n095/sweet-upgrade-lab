-- Add product status enum-like column (using text for flexibility)
-- Existing 'status' column already exists, let's check its current usage and update
-- Products already have a 'status' column (text, default 'active')
-- We just need to ensure it supports: active, coming_soon, hidden

-- No schema change needed since 'status' text column already exists
-- Just add an index for filtering
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products (status);

-- Add a comment for documentation
COMMENT ON COLUMN public.products.status IS 'Product status: active, coming_soon, hidden, draft, archived';