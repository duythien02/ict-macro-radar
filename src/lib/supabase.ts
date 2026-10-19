import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Trade, AppConfig, PropAccount, UserProfile } from "@/types";

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

export interface DatabaseHealthStatus {
  connected: boolean;
  url: string;
  anonKey: string;
  isConfigured: boolean;
  tables: {
    users: boolean;
    accounts: boolean;
    trades: boolean;
    user_config: boolean;
  };
  allTablesReady: boolean;
  hasUsers: boolean;
  hasAccounts: boolean;
  userCount: number;
  accountCount: number;
  missingTables: string[];
  error?: string;
}

export function saveSupabaseCredentials(url: string, key: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("ict_sb_url", url.trim());
    localStorage.setItem("ict_sb_key", key.trim());
  }
  cachedClient = null;
  cachedUrl = "";
  cachedKey = "";
}

export async function checkDatabaseHealth(customUrl?: string, customKey?: string): Promise<DatabaseHealthStatus> {
  const url = customUrl || (typeof window !== "undefined" ? localStorage.getItem("ict_sb_url") : null) || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = customKey || (typeof window !== "undefined" ? localStorage.getItem("ict_sb_key") : null) || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!url || !key) {
    return {
      connected: false,
      url: "",
      anonKey: "",
      isConfigured: false,
      tables: { users: false, accounts: false, trades: false, user_config: false },
      allTablesReady: false,
      hasUsers: false,
      hasAccounts: false,
      userCount: 0,
      accountCount: 0,
      missingTables: ["users", "accounts", "trades", "user_config"],
      error: "Chưa cấu hình URL hoặc Anon Key của Supabase.",
    };
  }

  try {
    const client = createClient(url, key);
    const tables = ["users", "accounts", "trades", "user_config"] as const;
    const tablesStatus = { users: false, accounts: false, trades: false, user_config: false };
    const missing: string[] = [];
    let firstError: string | undefined;

    for (const t of tables) {
      const { error } = await client.from(t).select("*", { count: "exact", head: true });
      if (error) {
        if (["PGRST205", "42P01", "PGRST204"].includes(error.code)) {
          tablesStatus[t] = false;
          missing.push(t);
        } else {
          tablesStatus[t] = false;
          missing.push(t);
          if (!firstError) firstError = `[${t}] ${error.message}`;
        }
      } else {
        tablesStatus[t] = true;
      }
    }

    let userCount = 0;
    let accountCount = 0;
    if (tablesStatus.users) {
      const { count } = await client.from("users").select("*", { count: "exact", head: true });
      userCount = count || 0;
    }
    if (tablesStatus.accounts) {
      const { count } = await client.from("accounts").select("*", { count: "exact", head: true });
      accountCount = count || 0;
    }

    const allReady = missing.length === 0;

    return {
      connected: true,
      url,
      anonKey: key,
      isConfigured: true,
      tables: tablesStatus,
      allTablesReady: allReady,
      hasUsers: userCount > 0,
      hasAccounts: accountCount > 0,
      userCount,
      accountCount,
      missingTables: missing,
      error: firstError,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      url,
      anonKey: key,
      isConfigured: true,
      tables: { users: false, accounts: false, trades: false, user_config: false },
      allTablesReady: false,
      hasUsers: false,
      hasAccounts: false,
      userCount: 0,
      accountCount: 0,
      missingTables: ["users", "accounts", "trades", "user_config"],
      error: msg,
    };
  }
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    const health = await checkDatabaseHealth(url, key);
    if (!health.connected) {
      return { success: false, message: health.error || "Không thể kết nối tới Supabase URL!" };
    }
    if (!health.allTablesReady) {
      return {
        success: false,
        message: `Kết nối thành công nhưng thiếu các bảng: ${health.missingTables.join(", ")}. Hãy chạy file supabase_schema.sql trong Supabase SQL Editor!`,
      };
    }
    return {
      success: true,
      message: `Kết nối Supabase thành công 100%! Đã sẵn sàng tất cả các bảng: users (${health.userCount}), accounts (${health.accountCount}), trades, user_config.`,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, message: `Lỗi kết nối: ${msg}` };
  }
}

// ==========================================
// USER NICKNAME OPERATIONS
// ==========================================
export async function fetchUsers(): Promise<UserProfile[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from("users").select("*").order("last_login_at", { ascending: false });
      if (!error && data) {
        return data.map((d: any) => ({
          nickname: d.nickname,
          displayName: d.display_name,
          createdAt: d.created_at,
          lastLoginAt: d.last_login_at,
        }));
      }
    } catch {}
  }

  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem("ict_recent_users");
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }

  return [];
}

export async function registerOrLoginUser(nickname: string, displayName?: string): Promise<UserProfile> {
  const cleanNick = nickname.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!cleanNick) {
    throw new Error("Nickname không hợp lệ");
  }
  const name = displayName?.trim() || cleanNick;
  const userObj: UserProfile = {
    nickname: cleanNick,
    displayName: name,
    lastLoginAt: new Date().toISOString(),
  };

  // Save to LocalStorage recent users
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("ict_active_user", cleanNick);
      const existing = await fetchUsers();
      const filtered = existing.filter((u) => u.nickname !== cleanNick);
      const updated = [userObj, ...filtered].slice(0, 8);
      localStorage.setItem("ict_recent_users", JSON.stringify(updated));
    } catch {}
  }

  // Save to Supabase
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from("users").upsert({
        nickname: cleanNick,
        display_name: name,
        last_login_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("Supabase user login warning:", e);
    }
  }

  return userObj;
}

// ==========================================
// ACCOUNTS OPERATIONS (PER USER NICKNAME)
// ==========================================
export async function fetchAccounts(userNickname?: string): Promise<PropAccount[]> {
  if (!userNickname) return [];

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("accounts")
        .select("*")
        .eq("user_nickname", userNickname)
        .order("created_at", { ascending: true });

      if (!error && data) {
        return data.map((d: any) => ({
          id: d.id,
          userNickname: d.user_nickname,
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
          riskPct: d.risk_pct !== null && d.risk_pct !== undefined ? Number(d.risk_pct) : 0.5,
          maxTradesDaily: d.max_trades_daily !== null && d.max_trades_daily !== undefined ? Number(d.max_trades_daily) : 3,
          maxLossRDaily: d.max_loss_r_daily !== null && d.max_loss_r_daily !== undefined ? Number(d.max_loss_r_daily) : 2,
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
        if (Array.isArray(parsed)) {
          const userAccounts = parsed.filter((a) => a.userNickname === userNickname);
          if (userAccounts.length > 0) return userAccounts;
        }
      }
    } catch {}
  }

  return [];
}

export async function insertAccount(acc: PropAccount): Promise<boolean> {
  const userNick = acc.userNickname || (typeof window !== "undefined" ? localStorage.getItem("ict_active_user") : null) || "demo_trader";
  const accWithUser: PropAccount = { ...acc, userNickname: userNick };

  // Save to LocalStorage
  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem("ict_accounts");
      const current: PropAccount[] = local ? JSON.parse(local) : [];
      const existingIdx = current.findIndex((a) => a.id === acc.id);
      let updated: PropAccount[];
      if (existingIdx >= 0) {
        updated = [...current];
        updated[existingIdx] = accWithUser;
      } else {
        updated = [...current, accWithUser];
      }
      localStorage.setItem("ict_accounts", JSON.stringify(updated));
    } catch {}
  }

  // Save to Supabase
  const sb = getSupabase();
  if (sb) {
    try {
      // Ensure user exists first
      await sb.from("users").upsert({
        nickname: userNick,
        last_login_at: new Date().toISOString(),
      });

      const row = {
        id: accWithUser.id,
        user_nickname: userNick,
        name: accWithUser.name,
        prop_firm: accWithUser.propFirm,
        account_type: accWithUser.accountType,
        balance: accWithUser.balance,
        current_balance: accWithUser.currentBalance ?? accWithUser.balance,
        mll: accWithUser.mll,
        mdl: accWithUser.mdl,
        target: accWithUser.target,
        status: accWithUser.status,
        consistency_pct: accWithUser.consistencyPct ?? 50,
        current_phase: accWithUser.currentPhase ?? 1,
        cfd_phases: accWithUser.cfdPhases ?? [],
        risk_pct: accWithUser.riskPct ?? 0.5,
        max_trades_daily: accWithUser.maxTradesDaily ?? 3,
        max_loss_r_daily: accWithUser.maxLossRDaily ?? 2,
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
      const local = localStorage.getItem("ict_accounts");
      if (local) {
        const current: PropAccount[] = JSON.parse(local);
        const updated = current.filter((a) => a.id !== id);
        localStorage.setItem("ict_accounts", JSON.stringify(updated));
      }
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
// TRADES OPERATIONS (PER USER NICKNAME)
// ==========================================
export async function fetchTrades(accountId?: string, userNickname = "demo_trader"): Promise<Trade[]> {
  const sb = getSupabase();
  if (!sb) {
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("ictm");
        if (local) {
          const parsed = JSON.parse(local);
          const allTrades: Trade[] = (parsed.trades || []).filter(
            (t: Trade) => (t.userNickname || "demo_trader") === userNickname
          );
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
    let query = sb
      .from("trades")
      .select("*")
      .eq("user_nickname", userNickname)
      .order("time", { ascending: true });

    if (accountId) {
      query = query.or(`account_id.eq.${accountId},account_id.is.null`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((t: any) => ({
      id: t.id,
      userNickname: t.user_nickname,
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
          const allTrades: Trade[] = (parsed.trades || []).filter(
            (t: Trade) => (t.userNickname || "demo_trader") === userNickname
          );
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
  const userNick = trade.userNickname || (typeof window !== "undefined" ? localStorage.getItem("ict_active_user") : null) || "demo_trader";
  const tradeWithUser: Trade = { ...trade, userNickname: userNick };

  const sb = getSupabase();
  if (sb) {
    try {
      const row = {
        id: tradeWithUser.id,
        user_nickname: userNick,
        account_id: tradeWithUser.accountId || null,
        pair: tradeWithUser.pair,
        pv: tradeWithUser.pv,
        side: tradeWithUser.side,
        ctr: tradeWithUser.ctr,
        sess: tradeWithUser.sess,
        setup: tradeWithUser.setup,
        entry: tradeWithUser.entry,
        sl: tradeWithUser.sl,
        tp: tradeWithUser.tp,
        exit: tradeWithUser.exit,
        pts: tradeWithUser.pts,
        pnl: tradeWithUser.pnl,
        r: tradeWithUser.r,
        disc: tradeWithUser.disc,
        notes: tradeWithUser.notes,
        time: tradeWithUser.time,
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
// USER CONFIG OPERATIONS (PER USER NICKNAME)
// ==========================================
export async function fetchConfig(userNickname = "demo_trader"): Promise<AppConfig> {
  const defaultConfig: AppConfig = { userNickname, bal: 50000, risk: 0.5, maxT: 3, maxL: 2 };
  const sb = getSupabase();

  if (sb) {
    try {
      const { data, error } = await sb.from("user_config").select("*").eq("id", userNickname).single();
      if (!error && data) {
        return {
          userNickname,
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
      const local = localStorage.getItem(`ictm_cfg_${userNickname}`);
      if (local) {
        const parsed = JSON.parse(local);
        return { ...defaultConfig, ...parsed };
      }
    } catch {}
  }

  return defaultConfig;
}

export async function saveConfig(cfg: AppConfig, userNickname = "demo_trader"): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`ictm_cfg_${userNickname}`, JSON.stringify(cfg));
    } catch {}
  }

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from("user_config").upsert({
        id: userNickname,
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
