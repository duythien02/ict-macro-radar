-- ========================================================
-- ICT MACRO RADAR - SUPABASE SCHEMA SETUP
-- Chạy đoạn script này trong SQL Editor của Supabase
-- ========================================================

-- 1. Bảng lưu trữ lệnh giao dịch (trades)
CREATE TABLE IF NOT EXISTS public.trades (
  id TEXT PRIMARY KEY,
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

-- 2. Bảng cấu hình quản lý vốn & quy tắc (user_config)
CREATE TABLE IF NOT EXISTS public.user_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  bal NUMERIC NOT NULL DEFAULT 50000,
  risk NUMERIC NOT NULL DEFAULT 0.5,
  max_t INTEGER NOT NULL DEFAULT 3,
  max_l NUMERIC NOT NULL DEFAULT 2.0,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tạo cấu hình mặc định ban đầu nếu chưa có
INSERT INTO public.user_config (id, bal, risk, max_t, max_l)
VALUES ('default', 50000, 0.5, 3, 2.0)
ON CONFLICT (id) DO NOTHING;

-- 4. Kích hoạt Row Level Security (RLS) & cấp quyền đọc/ghi công khai (hoặc theo auth)
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép truy cập trades công khai" ON public.trades
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Cho phép truy cập user_config công khai" ON public.user_config
  FOR ALL USING (true) WITH CHECK (true);
