-- ========================================================
-- ICT MACRO RADAR - SUPABASE SCHEMA SETUP (USERS & MULTI-PROP ACCOUNTS)
-- Chạy đoạn script này trong SQL Editor của Supabase
-- ========================================================

-- 1. Bảng quản lý người dùng theo Nickname (users)
CREATE TABLE IF NOT EXISTS public.users (
  nickname TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_login_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tạo người dùng mặc định ban đầu
INSERT INTO public.users (nickname, display_name)
VALUES ('demo_trader', 'Demo Trader')
ON CONFLICT (nickname) DO NOTHING;

-- 2. Bảng quản lý tài khoản quỹ (accounts) - gắn với user_nickname
CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY,
  user_nickname TEXT NOT NULL DEFAULT 'demo_trader' REFERENCES public.users(nickname) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prop_firm TEXT NOT NULL,      -- 'topstep' | 'bulenox' | 'the5ers' | 'other'
  account_type TEXT NOT NULL,   -- 'futures' | 'cfd'
  balance NUMERIC NOT NULL DEFAULT 50000,
  current_balance NUMERIC NOT NULL DEFAULT 50000,
  mll NUMERIC NOT NULL DEFAULT 2000,   -- Maximum Loss Limit / Trailing Drawdown ($)
  mdl NUMERIC NOT NULL DEFAULT 1000,   -- Maximum Daily Loss ($)
  target NUMERIC NOT NULL DEFAULT 3000, -- Profit Target ($)
  status TEXT NOT NULL DEFAULT 'eval', -- 'eval' | 'funded' | 'passed' | 'breached'
  consistency_pct NUMERIC DEFAULT 50,  -- Dành cho Futures Funded (mốc % consistency rule)
  current_phase INTEGER DEFAULT 1,     -- Vòng hiện tại dành cho CFD (1, 2, 3...)
  cfd_phases JSONB DEFAULT '[]'::jsonb, -- Danh sách mốc % target theo từng vòng CFD
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bổ sung cột user_nickname nếu bảng accounts đã tồn tại từ trước
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='accounts' AND column_name='user_nickname'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN user_nickname TEXT NOT NULL DEFAULT 'demo_trader';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounts_user_nickname ON public.accounts(user_nickname);

-- 3. Bảng lưu trữ lệnh giao dịch (trades) - gắn với account_id và user_nickname
CREATE TABLE IF NOT EXISTS public.trades (
  id TEXT PRIMARY KEY,
  user_nickname TEXT NOT NULL DEFAULT 'demo_trader',
  account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL,
  pair TEXT NOT NULL,
  pv NUMERIC NOT NULL DEFAULT 2,
  side INTEGER NOT NULL DEFAULT 1, -- 1: Long, -1: Short
  ctr INTEGER NOT NULL DEFAULT 1,
  sess TEXT NOT NULL,
  setup TEXT NOT NULL,
  entry NUMERIC NOT NULL,
  sl NUMERIC NOT NULL,
  tp NUMERIC NOT NULL,
  exit NUMERIC NOT NULL,
  pts NUMERIC NOT NULL DEFAULT 0,
  pnl NUMERIC NOT NULL DEFAULT 0,
  r NUMERIC NOT NULL DEFAULT 0,
  disc BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  time BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bổ sung cột user_nickname và account_id nếu bảng trades đã tồn tại
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='trades' AND column_name='account_id'
  ) THEN
    ALTER TABLE public.trades ADD COLUMN account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='trades' AND column_name='user_nickname'
  ) THEN
    ALTER TABLE public.trades ADD COLUMN user_nickname TEXT NOT NULL DEFAULT 'demo_trader';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trades_user_nickname ON public.trades(user_nickname);

-- 4. Bảng cấu hình người dùng (user_config)
CREATE TABLE IF NOT EXISTS public.user_config (
  id TEXT PRIMARY KEY DEFAULT 'demo_trader',
  active_account_id TEXT,
  bal NUMERIC NOT NULL DEFAULT 50000,
  risk NUMERIC NOT NULL DEFAULT 0.5,
  max_t INTEGER NOT NULL DEFAULT 3,
  max_l NUMERIC NOT NULL DEFAULT 2.0,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Kích hoạt Row Level Security (RLS) & cấp quyền truy cập
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cho phép truy cập users công khai" ON public.users;
CREATE POLICY "Cho phép truy cập users công khai" ON public.users
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Cho phép truy cập accounts công khai" ON public.accounts;
CREATE POLICY "Cho phép truy cập accounts công khai" ON public.accounts
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Cho phép truy cập trades công khai" ON public.trades;
CREATE POLICY "Cho phép truy cập trades công khai" ON public.trades
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Cho phép truy cập user_config công khai" ON public.user_config;
CREATE POLICY "Cho phép truy cập user_config công khai" ON public.user_config
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Tạo dữ liệu tài khoản mẫu mặc định cho demo_trader
INSERT INTO public.accounts (id, user_nickname, name, prop_firm, account_type, balance, current_balance, mll, mdl, target, status, consistency_pct, current_phase, cfd_phases)
VALUES 
(
  'ACC-TOPSTEP-50K', 
  'demo_trader',
  'Topstep 50K Combine', 
  'topstep', 
  'futures', 
  50000, 
  50000, 
  2000, 
  1000, 
  3000, 
  'eval', 
  50, 
  1, 
  '[]'::jsonb
),
(
  'ACC-THE5ERS-100K', 
  'demo_trader',
  'The5ers 100K High Stakes', 
  'the5ers', 
  'cfd', 
  100000, 
  100000, 
  10000, 
  5000, 
  8000, 
  'eval', 
  0, 
  1, 
  '[{"phase": 1, "name": "Vòng 1 (Challenge)", "targetPct": 8, "mdlPct": 5, "mllPct": 10}, {"phase": 2, "name": "Vòng 2 (Verification)", "targetPct": 5, "mdlPct": 5, "mllPct": 10}, {"phase": 3, "name": "Funded Account", "targetPct": 0, "mdlPct": 5, "mllPct": 10}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

