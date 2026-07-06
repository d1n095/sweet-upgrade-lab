
-- ============================================================
-- SPRINT 1 - ERP & EKONOMI (Del 8)
-- ============================================================

-- 1. SUPPLIERS
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  org_number TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  city TEXT,
  zip TEXT,
  country TEXT DEFAULT 'SE',
  payment_terms_days INT NOT NULL DEFAULT 30,
  currency TEXT NOT NULL DEFAULT 'SEK',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance can manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.is_finance_or_founder(auth.uid()))
  WITH CHECK (public.is_finance_or_founder(auth.uid()));
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_suppliers_active ON public.suppliers(is_active) WHERE is_active = true;

-- 2. EXPENSES
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 25,
  currency TEXT NOT NULL DEFAULT 'SEK',
  category TEXT NOT NULL,
  description TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','partial','overdue','cancelled')),
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  receipt_url TEXT,
  reference TEXT,
  booked_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance can manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (public.is_finance_or_founder(auth.uid()))
  WITH CHECK (public.is_finance_or_founder(auth.uid()));
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX idx_expenses_status ON public.expenses(payment_status);
CREATE INDEX idx_expenses_supplier ON public.expenses(supplier_id);

-- 3. INVOICES
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('customer','supplier')),
  counterparty_name TEXT NOT NULL,
  counterparty_org_number TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  amount_ex_vat NUMERIC(14,2) NOT NULL CHECK (amount_ex_vat >= 0),
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_total NUMERIC(14,2) NOT NULL CHECK (amount_total >= 0),
  currency TEXT NOT NULL DEFAULT 'SEK',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','partial','overdue','cancelled')),
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance can manage invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_finance_or_founder(auth.uid()))
  WITH CHECK (public.is_finance_or_founder(auth.uid()));
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_invoices_type_status ON public.invoices(invoice_type, status);
CREATE INDEX idx_invoices_due ON public.invoices(due_date) WHERE status NOT IN ('paid','cancelled');
CREATE INDEX idx_invoices_order ON public.invoices(order_id);

-- 4. PURCHASE ORDERS
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','partial','received','cancelled')),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  received_at TIMESTAMPTZ,
  total_ex_vat NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SEK',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance can manage purchase orders" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (public.is_finance_or_founder(auth.uid()))
  WITH CHECK (public.is_finance_or_founder(auth.uid()));
CREATE TRIGGER trg_po_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON public.purchase_orders(status);

-- 5. LEDGER ENTRIES (huvudbok / dubbel bokföring)
CREATE TABLE public.ledger_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  verification_number TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  account TEXT NOT NULL,
  account_name TEXT,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('order','invoice','expense','manual','adjustment','payout')),
  source_id TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  fiscal_period TEXT,
  currency TEXT NOT NULL DEFAULT 'SEK',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ledger_debit_or_credit CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0))
);
GRANT SELECT, INSERT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance can read ledger" ON public.ledger_entries
  FOR SELECT TO authenticated
  USING (public.is_finance_or_founder(auth.uid()));
CREATE POLICY "Finance can insert ledger" ON public.ledger_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_or_founder(auth.uid()));
CREATE INDEX idx_ledger_verification ON public.ledger_entries(verification_number);
CREATE INDEX idx_ledger_date ON public.ledger_entries(entry_date DESC);
CREATE INDEX idx_ledger_source ON public.ledger_entries(source_type, source_id);
CREATE INDEX idx_ledger_account ON public.ledger_entries(account);
CREATE INDEX idx_ledger_period ON public.ledger_entries(fiscal_period);

-- 6. CASH POSITIONS (daglig kassaposition)
CREATE TABLE public.cash_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position_date DATE NOT NULL,
  account_name TEXT NOT NULL,
  bank_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  outstanding_incoming NUMERIC(14,2) NOT NULL DEFAULT 0,
  outstanding_outgoing NUMERIC(14,2) NOT NULL DEFAULT 0,
  available_cash NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SEK',
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (position_date, account_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_positions TO authenticated;
GRANT ALL ON public.cash_positions TO service_role;
ALTER TABLE public.cash_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance can manage cash positions" ON public.cash_positions
  FOR ALL TO authenticated
  USING (public.is_finance_or_founder(auth.uid()))
  WITH CHECK (public.is_finance_or_founder(auth.uid()));
CREATE TRIGGER trg_cash_positions_updated_at BEFORE UPDATE ON public.cash_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_cash_date ON public.cash_positions(position_date DESC);

-- 7. HELPER: nästa verifikationsnummer
CREATE OR REPLACE FUNCTION public.next_verification_number(p_year INT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT);
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX(SPLIT_PART(verification_number, '-', 2)::INT), 0) + 1
    INTO v_seq
    FROM public.ledger_entries
    WHERE verification_number LIKE v_year::TEXT || '-%';
  RETURN v_year::TEXT || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;
