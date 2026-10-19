export interface MacroSession {
  id: string;
  n: string;
  t: string;
  s: number;
  e: number;
  k?: number;
  m: string;
}

export interface Trade {
  id: string;
  pair: string;
  pv: number;
  side: number; // 1 for Long, -1 for Short
  ctr: number;
  sess: string;
  setup: string;
  entry: number;
  sl: number;
  tp: number;
  exit: number;
  pts: number;
  pnl: number;
  r: number;
  disc: boolean;
  notes?: string;
  time: number;
}

export interface AppConfig {
  bal: number;
  risk: number;
  maxT: number;
  maxL: number;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface ChecklistItem {
  title: string;
  desc: string;
  required: boolean;
}
