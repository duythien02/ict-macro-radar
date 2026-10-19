import { MacroSession, ChecklistItem, PropAccount } from "@/types";

export const SES: MacroSession[] = [
  { id: "a1", n: "Asia Macro 1", t: "Mở Asia", s: 1250, e: 1270, m: "Tích lũy Asian Range ban đầu, quét thanh khoản sớm" },
  { id: "a2", n: "Asia Macro 2", t: "Mở Tokyo", s: 1310, e: 1330, m: "Tạo đỉnh/đáy ngày cho AUD, JPY; tạo thanh khoản cho London" },
  { id: "l1", n: "London Macro 1", t: "Mở London", s: 153, e: 180, m: "Mở rộng đầu London, Judas Swing quét range châu Á" },
  { id: "l2", n: "London Macro 2", t: "Giữa London", s: 243, e: 270, m: "Tái phân phối hoặc đẩy thanh khoản theo xu hướng London" },
  { id: "n1", n: "NY AM Macro 1", t: "Mở sàn", s: 530, e: 550, k: 1, m: "Khung giờ vàng: chuẩn bị mở sàn 09:30" },
  { id: "n2", n: "NY AM Macro 2", t: "Equities Run", s: 590, e: 610, k: 1, m: "Quét đỉnh/đáy 09:30, kích hoạt Silver Bullet" },
  { id: "n3", n: "NY AM Macro 3", t: "Đóng phiên sáng", s: 650, e: 670, k: 1, m: "Hoàn thành nhịp di chuyển sáng New York" },
  { id: "ln", n: "NY Lunch", t: "Ăn trưa", s: 710, e: 730, m: "Rebalance FVG hẹp, tránh sideway" },
  { id: "pm", n: "NY PM Macro", t: "PM Run", s: 790, e: 820, m: "Khởi động phiên chiều, đẩy nốt thanh khoản ngày" },
  { id: "lh", n: "NY Last Hour", t: "Cuối ngày", s: 915, e: 945, m: "Chốt vị thế trước 16:00 Equities Close" }
];

export const CHK: ChecklistItem[] = [
  { title: "Đúng khung giờ ICT Macro", desc: "Vào lệnh trong 20 phút của Macro, không vào lúc ngoài phiên", required: true },
  { title: "Bias khung lớn & mục tiêu DOL", desc: "Xác định hướng D1/H4/H1 và đích thanh khoản (Draw on Liquidity)", required: true },
  { title: "Quét thanh khoản (Liquidity Sweep)", desc: "Giá đã quét đỉnh/đáy phiên trước, Asian High/Low hoặc Equal Highs/Lows", required: false },
  { title: "MSS + Displacement", desc: "Nến thân to phá vỡ cấu trúc và để lại khoảng trống giá FVG", required: false },
  { title: "Vào lệnh tại FVG / OB / OTE", desc: "Chờ giá hồi về vùng Premium/Discount, tuyệt đối không đuổi nến", required: false },
  { title: "Quản lý vốn: SL tuyệt đối, R:R ≥ 1:2", desc: "Rủi ro ≤ 1% tài khoản, TP tối thiểu gấp đôi khoảng dừng lỗ", required: true },
  { title: "Tâm lý tỉnh táo", desc: "Tuân thủ xuất sắc, không giao dịch trả thù thị trường sau lệnh thua", required: true }
];

export const PV: Record<string, number> = {
  MNQ: 2,
  NQ: 20,
  MES: 5,
  ES: 50,
  MGC: 10
};

export const SETUPS = [
  "Liquidity Sweep + FVG",
  "MSS + Displacement",
  "Order Block + OTE",
  "Silver Bullet",
  "Judas Swing + Breaker Block"
];

export const DEFAULT_ACCOUNTS: PropAccount[] = [];

export const PROP_PRESETS = [
  {
    firm: "topstep" as const,
    label: "Topstep 50K Combine",
    type: "futures" as const,
    balance: 50000,
    mll: 2000,
    mdl: 1000,
    target: 3000,
    consistency: 50,
    riskPct: 0.5,
    maxTradesDaily: 3,
    maxLossRDaily: 2,
  },
  {
    firm: "topstep" as const,
    label: "Topstep 100K Combine",
    type: "futures" as const,
    balance: 100000,
    mll: 3000,
    mdl: 2000,
    target: 6000,
    consistency: 50,
    riskPct: 0.5,
    maxTradesDaily: 3,
    maxLossRDaily: 2,
  },
  {
    firm: "topstep" as const,
    label: "Topstep 150K Combine",
    type: "futures" as const,
    balance: 150000,
    mll: 4500,
    mdl: 3000,
    target: 9000,
    consistency: 50,
    riskPct: 0.5,
    maxTradesDaily: 3,
    maxLossRDaily: 2,
  },
  {
    firm: "bulenox" as const,
    label: "Bulenox 25K Qualifying",
    type: "futures" as const,
    balance: 25000,
    mll: 1500,
    mdl: 1000,
    target: 1500,
    consistency: 40,
    riskPct: 0.5,
    maxTradesDaily: 3,
    maxLossRDaily: 2,
  },
  {
    firm: "bulenox" as const,
    label: "Bulenox 50K Qualifying",
    type: "futures" as const,
    balance: 50000,
    mll: 2500,
    mdl: 1500,
    target: 3000,
    consistency: 40,
    riskPct: 0.5,
    maxTradesDaily: 3,
    maxLossRDaily: 2,
  },
  {
    firm: "bulenox" as const,
    label: "Bulenox 100K Qualifying",
    type: "futures" as const,
    balance: 100000,
    mll: 3000,
    mdl: 2000,
    target: 6000,
    consistency: 40,
    riskPct: 0.5,
    maxTradesDaily: 3,
    maxLossRDaily: 2,
  },
  {
    firm: "the5ers" as const,
    label: "The5ers 60K High Stakes",
    type: "cfd" as const,
    balance: 60000,
    mll: 6000,
    mdl: 3000,
    target: 4800,
    riskPct: 0.5,
    maxTradesDaily: 3,
    maxLossRDaily: 2,
    phases: [
      { phase: 1, name: "Vòng 1 (Challenge)", targetPct: 8, mdlPct: 5, mllPct: 10 },
      { phase: 2, name: "Vòng 2 (Verification)", targetPct: 5, mdlPct: 5, mllPct: 10 },
      { phase: 3, name: "Funded Live", targetPct: 0, mdlPct: 5, mllPct: 10 },
    ],
  },
  {
    firm: "the5ers" as const,
    label: "The5ers 100K High Stakes",
    type: "cfd" as const,
    balance: 100000,
    mll: 10000,
    mdl: 5000,
    target: 8000,
    riskPct: 0.5,
    maxTradesDaily: 3,
    maxLossRDaily: 2,
    phases: [
      { phase: 1, name: "Vòng 1 (Challenge)", targetPct: 8, mdlPct: 5, mllPct: 10 },
      { phase: 2, name: "Vòng 2 (Verification)", targetPct: 5, mdlPct: 5, mllPct: 10 },
      { phase: 3, name: "Funded Live", targetPct: 0, mdlPct: 5, mllPct: 10 },
    ],
  },
];

export const SQL_SCHEMA_SCRIPT = `-- ========================================================
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
  risk_pct NUMERIC DEFAULT 0.5,        -- Rủi ro mỗi lệnh (% tài khoản)
  max_trades_daily INTEGER DEFAULT 3,  -- Số lệnh tối đa mỗi ngày
  max_loss_r_daily NUMERIC DEFAULT 2,  -- Mức lỗ tối đa trong ngày (R)
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bổ sung các cột mới nếu bảng accounts đã tồn tại từ trước
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='accounts' AND column_name='user_nickname'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN user_nickname TEXT NOT NULL DEFAULT 'demo_trader';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='accounts' AND column_name='risk_pct'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN risk_pct NUMERIC DEFAULT 0.5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='accounts' AND column_name='max_trades_daily'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN max_trades_daily INTEGER DEFAULT 3;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='accounts' AND column_name='max_loss_r_daily'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN max_loss_r_daily NUMERIC DEFAULT 2;
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

-- 6. Làm mới bộ nhớ đệm PostgREST Schema Cache để nhận diện ngay các bảng mới
NOTIFY pgrst, 'reload schema';
`;

