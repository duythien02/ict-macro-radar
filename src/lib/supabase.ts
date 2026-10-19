import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Trade, AppConfig, PropAccount } from "@/types";
import { DEFAULT_ACCOUNTS } from "@/lib/constants";

let cachedClient: SupabaseClient | null = null;
let cachedUrl = "";
let cachedKey = "";

export function getSupabase(customUrl?: string, customKey?: string): SupabaseClient | null {
  const url = customUrl || (typeof window !== "undefined" ? localStorage.getItem("ict_sb_url") : null) || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = customKey || (typeof window !== "undefined" ? localStorage.getItem("ict_sb_key") : null) || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!url || !key) return null;

  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key);
    cachedUrl = url;
    cachedKey = key;
    return cachedClient;
  } catch (err) {
    console.error("Supabase init error:", err);
    return null;
  }
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    const client = createClient(url, key);
    const { error } = await client.from("accounts").select("id").limit(1);
    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return { success: false, message: "Kết nối thành công nhưng chưa tạo bảng 'accounts'. Hãy chạy file supabase_schema.sql!" };
      }
      return { success: false, message: `Lỗi: ${error.message}` };
    }
    return { success: true, message: "Kết nối Supabase thành công! Dữ liệu đã sẵn sàng." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, message: `Lỗi kết nối: ${msg}` };
  }
}

// ==========================================
// ACCOUNTS OPERATIONS
// ==========================================
export async function fetchAccounts(): Promise<PropAccount[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from("accounts").select("*").order("created_at", { ascending: true });
      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          name: d.name,
          propFirm: d.prop_firm,
          accountType: d.account_type,
          balance: Number(d.balance),
          currentBalance: Number(d.current_balance ?? d.balance),
          mll: Number(d.mll),
          mdl: Number(d.mdl),
          target: Number(d.target),
          status: d.status,
          consistencyPct: d.consistency_pct !== null ? Number(d.consistency_pct) : undefined,
          currentPhase: d.current_phase !== null ? Number(d.current_phase) : undefined,
          cfdPhases: d.cfd_phases || [],
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch (e) {
      console.warn("Lỗi tải accounts từ Supabase, chuyển sang fallback LocalStorage:", e);
    }
  }

  // LocalStorage fallback
  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem("ict_accounts");
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      // Save default accounts on first load
      localStorage.setItem("ict_accounts", JSON.stringify(DEFAULT_ACCOUNTS));
      return DEFAULT_ACCOUNTS;
    } catch {}
  }

  return DEFAULT_ACCOUNTS;
}

export async function insertAccount(acc: PropAccount): Promise<boolean> {
  // Save to LocalStorage
  if (typeof window !== "undefined") {
    try {
      const current = await fetchAccounts();
      const existingIdx = current.findIndex((a) => a.id === acc.id);
      let updated: PropAccount[];
      if (existingIdx >= 0) {
        updated = [...current];
        updated[existingIdx] = acc;
      } else {
        updated = [...current, acc];
      }
      localStorage.setItem("ict_accounts", JSON.stringify(updated));
    } catch {}
  }

  // Save to Supabase
  const sb = getSupabase();
  if (sb) {
    try {
      const row = {
        id: acc.id,
        name: acc.name,
        prop_firm: acc.propFirm,
        account_type: acc.accountType,
        balance: acc.balance,
        current_balance: acc.currentBalance ?? acc.balance,
        mll: acc.mll,
        mdl: acc.mdl,
        target: acc.target,
        status: acc.status,
        consistency_pct: acc.consistencyPct ?? 50,
        current_phase: acc.currentPhase ?? 1,
        cfd_phases: acc.cfdPhases ?? [],
        updated_at: new Date().toISOString(),
      };
      const { error } = await sb.from("accounts").upsert(row);
      if (error) console.error("Lỗi lưu account Supabase:", error);
    } catch (e) {
      console.error("Supabase insertAccount error:", e);
    }
  }

  return true;
}

export async function removeAccount(id: string): Promise<boolean> {
  // Remove from LocalStorage
  if (typeof window !== "undefined") {
    try {
      const current = await fetchAccounts();
      const updated = current.filter((a) => a.id !== id);
      localStorage.setItem("ict_accounts", JSON.stringify(updated));
    } catch {}
  }

  // Remove from Supabase
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("accounts").delete().eq("id", id);
      if (error) console.error("Lỗi xóa account Supabase:", error);
    } catch (e) {
      console.error("Supabase removeAccount error:", e);
    }
  }

  return true;
}

// ==========================================
// TRADES OPERATIONS
// ==========================================
export async function fetchTrades(accountId?: string): Promise<Trade[]> {
  const sb = getSupabase();
  if (!sb) {
    // Fallback to localStorage
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("ictm");
        if (local) {
          const parsed = JSON.parse(local);
          const allTrades: Trade[] = parsed.trades || [];
          if (accountId) {
            return allTrades.filter((t) => !t.accountId || t.accountId === accountId);
          }
          return allTrades;
        }
      } catch {}
    }
    return [];
  }

  try {
    let query = sb.from("trades").select("*").order("time", { ascending: true });
    if (accountId) {
      query = query.or(`account_id.eq.${accountId},account_id.is.null`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((t: any) => ({
      id: t.id,
      accountId: t.account_id,
      pair: t.pair,
      pv: Number(t.pv),
      side: Number(t.side),
      ctr: Number(t.ctr),
      sess: t.sess,
      setup: t.setup,
      entry: Number(t.entry),
      sl: Number(t.sl),
      tp: Number(t.tp),
      exit: Number(t.exit),
      pts: Number(t.pts),
      pnl: Number(t.pnl),
      r: Number(t.r),
      disc: Boolean(t.disc),
      notes: t.notes,
      time: Number(t.time),
    }));
  } catch (err) {
    console.warn("Lỗi tải Supabase, dùng LocalStorage dự phòng:", err);
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("ictm");
        if (local) {
          const parsed = JSON.parse(local);
          const allTrades: Trade[] = parsed.trades || [];
          if (accountId) {
            return allTrades.filter((t) => !t.accountId || t.accountId === accountId);
          }
          return allTrades;
        }
      } catch {}
    }
    return [];
  }
}

export async function insertTrade(trade: Trade): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    try {
      const row = {
        id: trade.id,
        account_id: trade.accountId || null,
        pair: trade.pair,
        pv: trade.pv,
        side: trade.side,
        ctr: trade.ctr,
        sess: trade.sess,
        setup: trade.setup,
        entry: trade.entry,
        sl: trade.sl,
        tp: trade.tp,
        exit: trade.exit,
        pts: trade.pts,
        pnl: trade.pnl,
        r: trade.r,
        disc: trade.disc,
        notes: trade.notes,
        time: trade.time,
      };
      const { error } = await sb.from("trades").upsert(row);
      if (error) console.error("Lỗi lưu Supabase:", error);
    } catch (e) {
      console.error("Supabase insert error:", e);
    }
  }
  return true;
}

export async function removeTrade(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("trades").delete().eq("id", id);
      if (error) console.error("Lỗi xóa Supabase:", error);
    } catch (e) {
      console.error("Supabase delete error:", e);
    }
  }
  return true;
}

// ==========================================
// USER CONFIG OPERATIONS
// ==========================================
export async function fetchConfig(): Promise<AppConfig> {
  const defaultConfig: AppConfig = { bal: 50000, risk: 0.5, maxT: 3, maxL: 2 };
  const sb = getSupabase();

  if (sb) {
    try {
      const { data, error } = await sb.from("user_config").select("*").eq("id", "default").single();
      if (!error && data) {
        return {
          activeAccountId: data.active_account_id,
          bal: Number(data.bal) || defaultConfig.bal,
          risk: Number(data.risk) || defaultConfig.risk,
          maxT: Number(data.max_t) || defaultConfig.maxT,
          maxL: Number(data.max_l) || defaultConfig.maxL,
        };
      }
    } catch {}
  }

  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem("ictm");
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.cfg) return { ...defaultConfig, ...parsed.cfg };
      }
    } catch {}
  }

  return defaultConfig;
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from("user_config").upsert({
        id: "default",
        active_account_id: cfg.activeAccountId,
        bal: cfg.bal,
        risk: cfg.risk,
        max_t: cfg.maxT,
        max_l: cfg.maxL,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Supabase save config error:", e);
    }
  }
}
