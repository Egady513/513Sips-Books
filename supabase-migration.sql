-- 513 Sips Books - New Tables Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================
-- 1. NEW TABLES
-- ============================================

-- Expenses (detailed expense tracking with Schedule C mapping)
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor TEXT,
    is_tax_deductible BOOLEAN DEFAULT true,
    schedule_c_line TEXT,
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mileage Log (IRS standard mileage deduction)
CREATE TABLE IF NOT EXISTS mileage_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    trip_date DATE NOT NULL,
    from_location TEXT,
    to_location TEXT,
    miles DECIMAL(6,1) NOT NULL,
    purpose TEXT,
    rate_per_mile DECIMAL(4,3) NOT NULL DEFAULT 0.70,
    deduction_amount DECIMAL(10,2) GENERATED ALWAYS AS (miles * rate_per_mile) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Transactions (for reconciliation)
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    import_batch TEXT NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    matched_ar_entry_id UUID REFERENCES ar_entries(id),
    matched_ap_entry_id UUID REFERENCES ap_entries(id),
    matched_expense_id UUID REFERENCES expenses(id),
    status TEXT DEFAULT 'unmatched' CHECK (status IN ('unmatched','matched','ignored')),
    notes TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings (key-value config)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings
INSERT INTO settings (key, value) VALUES
    ('business_name', '513 Sips'),
    ('owner_name', 'Eddie'),
    ('mileage_rate_2025', '0.70'),
    ('mileage_rate_2026', '0.70'),
    ('invoice_prefix', '513'),
    ('theme', 'dark')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 2. ALTER EXISTING TABLES (add new columns)
-- ============================================

-- Events: add extra fields for richer event management
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS notes TEXT;

-- AP Entries: link to events, owner draw tracking, tax categorization
ALTER TABLE ap_entries ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE ap_entries ADD COLUMN IF NOT EXISTS is_owner_draw BOOLEAN DEFAULT false;
ALTER TABLE ap_entries ADD COLUMN IF NOT EXISTS schedule_c_line TEXT;

-- ============================================
-- 3. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_event ON expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_mileage_date ON mileage_log(trip_date);
CREATE INDEX IF NOT EXISTS idx_mileage_event ON mileage_log(event_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_status ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_ap_entries_event ON ap_entries(event_id);

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE mileage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all access (single-user app using anon key)
CREATE POLICY "Allow all" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON mileage_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON bank_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON settings FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 5. STORAGE BUCKET FOR RECEIPTS
-- ============================================
-- NOTE: Create this manually in Supabase Dashboard > Storage > New Bucket
-- Bucket name: receipts
-- Public access: true
-- Allowed file types: image/*, application/pdf
