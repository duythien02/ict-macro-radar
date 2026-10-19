export type AccountType = "futures" | "cfd";
export type PropFirm = "topstep" | "bulenox" | "the5ers" | "other";
export type AccountStatus = "eval" | "funded" | "passed" | "breached";

export interface CFDPhase {
  phase: number;
  name: string;
  targetPct: number; // e.g. 8%
  mdlPct: number;    // e.g. 5%
  mllPct: number;    // e.g. 10%
}

export interface UserProfile {
  nickname: string;
  displayName?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface PropAccount {
  id: string;
  userNickname?: string;  // Nickname sở hữu tài khoản quỹ
  name: string;
  propFirm: PropFirm;
  accountType: AccountType;
  balance: number;        // Kích thước tài khoản ban đầu ($)
  currentBalance?: number;// Số dư hiện tại ($)
  mll: number;            // Max Loss Limit / Trailing Drawdown ($)
  mdl: number;            // Max Daily Loss ($)
  target: number;         // Profit Target ($)
  status: AccountStatus;  // 'eval' | 'funded' | 'passed' | 'breached'

  // Mốc consistency (Dành cho Futures Funded, ví dụ 50% rule)
  consistencyPct?: number;

  // Dành riêng cho CFD (ví dụ The5ers theo từng vòng):
  currentPhase?: number;
  cfdPhases?: CFDPhase[];

  // Quy tắc quản lý rủi ro riêng của từng tài khoản quỹ
  riskPct?: number;        // Rủi ro mỗi lệnh (% tài khoản), ví dụ 0.5%
  maxTradesDaily?: number; // Số lệnh tối đa mỗi ngày, ví dụ 3 lệnh
  maxLossRDaily?: number;  // Mức lỗ tối đa trong ngày (R), ví dụ 2R

  createdAt?: string;
  updatedAt?: string;
}

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
  userNickname?: string; // Nickname sở hữu lệnh
  accountId?: string;    // Gắn lệnh với tài khoản quỹ cụ thể
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
  userNickname?: string;
  activeAccountId?: string;
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

