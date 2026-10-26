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
// USER AUTHENTICATION & PASSWORD SECURITY
// ==========================================

export async function hashPassword(password: string, salt: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(`${salt}:${password}`);
    const hashBuf = await crypto.subtle.digest("SHA-256", data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Simple fallback
  let hash = 0;
  const str = `${salt}:${password}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export function generateSalt(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Local users storage fallback (for offline or local testing)
interface StoredLocalUser {
  nickname: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  lastLoginAt: string;
}

function getLocalUsers(): StoredLocalUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("ict_local_auth_users");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUsers(users: StoredLocalUser[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("ict_local_auth_users", JSON.stringify(users));
  } catch {}
}

export async function fetchUsers(): Promise<UserProfile[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from("users").select("nickname, display_name, created_at, last_login_at, password_hash").order("last_login_at", { ascending: false });
      if (!error && data) {
        return data.map((d: any) => ({
          nickname: d.nickname,
          displayName: d.display_name,
          createdAt: d.created_at,
          lastLoginAt: d.last_login_at,
          hasPassword: !!d.password_hash,
        }));
      }
    } catch {}
  }

  // Fallback to local auth users
  const localAuth = getLocalUsers();
  if (localAuth.length > 0) {
    return localAuth.map((u) => ({
      nickname: u.nickname,
      displayName: u.displayName,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      hasPassword: true,
    }));
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

/**
 * Đăng ký tài khoản mới với Username và Mật khẩu
 */
export async function registerUser(
  username: string,
  password: string,
  displayName?: string
): Promise<UserProfile> {
  const cleanNick = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!cleanNick || cleanNick.length < 3) {
    throw new Error("Tên đăng nhập phải có ít nhất 3 ký tự (chỉ gồm chữ cái, số, gạch dưới _ hoặc -).");
  }

  if (!password || password.length < 4) {
    throw new Error("Mật khẩu phải có độ dài tối thiểu 4 ký tự.");
  }

  const name = displayName?.trim() || cleanNick;
  const now = new Date().toISOString();
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const sb = getSupabase();
  if (sb) {
    // 1. Kiểm tra tài khoản đã tồn tại trên Supabase chưa
    const { data: existingUser, error: checkErr } = await sb
      .from("users")
      .select("nickname")
      .eq("nickname", cleanNick)
      .maybeSingle();

    if (existingUser) {
      throw new Error(`Tên đăng nhập '${cleanNick}' đã tồn tại! Vui lòng chọn tên khác hoặc chuyển sang Đăng nhập.`);
    }

    // 2. Insert tài khoản mới vào Supabase
    const { error: insertErr } = await sb.from("users").insert({
      nickname: cleanNick,
      display_name: name,
      password_hash: passwordHash,
      salt: salt,
      created_at: now,
      last_login_at: now,
    });

    if (insertErr) {
      // Nếu cột password_hash chưa tồn tại trong Supabase, thử fallback insert cơ bản và cảnh báo
      if (insertErr.message.includes("password_hash") || insertErr.code === "42703") {
        console.warn("Cột password_hash chưa có trong bảng users, hãy chạy lại script SQL!");
        await sb.from("users").insert({
          nickname: cleanNick,
          display_name: name,
          created_at: now,
          last_login_at: now,
        });
      } else {
        throw new Error(`Lỗi đăng ký Supabase: ${insertErr.message}`);
      }
    }

    // 3. Khởi tạo cấu hình user_config mặc định
    await sb.from("user_config").upsert({
      id: cleanNick,
      active_account_id: null,
      bal: 50000,
      risk: 0.5,
      max_t: 3,
      max_l: 2.0,
      updated_at: now,
    });
  }

  // Lưu tài khoản cục bộ dự phòng
  const localUsers = getLocalUsers();
  const existingLocal = localUsers.find((u) => u.nickname === cleanNick);
  if (!existingLocal) {
    localUsers.unshift({
      nickname: cleanNick,
      displayName: name,
      passwordHash,
      salt,
      createdAt: now,
      lastLoginAt: now,
    });
    saveLocalUsers(localUsers);
  }

  const userObj: UserProfile = {
    nickname: cleanNick,
    displayName: name,
    createdAt: now,
    lastLoginAt: now,
    hasPassword: true,
  };

  // Lưu session đăng nhập vào localStorage
  if (typeof window !== "undefined") {
    localStorage.setItem("ict_active_user", cleanNick);
    const existing = await fetchUsers();
    const filtered = existing.filter((u) => u.nickname !== cleanNick);
    localStorage.setItem("ict_recent_users", JSON.stringify([userObj, ...filtered].slice(0, 8)));
  }

  return userObj;
}

/**
 * Đăng nhập tài khoản bằng Tên đăng nhập và Mật khẩu
 */
export async function loginUser(username: string, password: string): Promise<UserProfile> {
  const cleanNick = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!cleanNick) {
    throw new Error("Vui lòng nhập tên đăng nhập!");
  }
  if (!password) {
    throw new Error("Vui lòng nhập mật khẩu!");
  }

  const sb = getSupabase();
  let verifiedUser: UserProfile | null = null;
  const now = new Date().toISOString();

  if (sb) {
    const { data: dbUser, error } = await sb
      .from("users")
      .select("*")
      .eq("nickname", cleanNick)
      .maybeSingle();

    if (error) {
      console.warn("Lỗi kiểm tra user Supabase:", error);
    }

    if (dbUser) {
      // Trường hợp 1: User đã có mật khẩu trong DB
      if (dbUser.password_hash && dbUser.salt) {
        const computedHash = await hashPassword(password, dbUser.salt);
        if (computedHash !== dbUser.password_hash) {
          throw new Error("Mật khẩu không chính xác! Vui lòng thử lại.");
        }
      } else {
        // Trường hợp 2: Tài khoản cũ chưa gán mật khẩu -> tự động cập nhật mật khẩu lần đầu
        const newSalt = generateSalt();
        const newHash = await hashPassword(password, newSalt);
        try {
          await sb.from("users").update({
            password_hash: newHash,
            salt: newSalt,
            last_login_at: now,
          }).eq("nickname", cleanNick);
        } catch {}
      }

      // Cập nhật last_login_at
      try {
        await sb.from("users").update({ last_login_at: now }).eq("nickname", cleanNick);
      } catch {}

      verifiedUser = {
        nickname: dbUser.nickname,
        displayName: dbUser.display_name || dbUser.nickname,
        createdAt: dbUser.created_at,
        lastLoginAt: now,
        hasPassword: true,
      };
    }
  }

  // Nếu chưa xác thực qua Supabase hoặc Supabase không tìm thấy: kiểm tra local fallback
  if (!verifiedUser) {
    const localUsers = getLocalUsers();
    const matched = localUsers.find((u) => u.nickname === cleanNick);
    if (matched) {
      const computedHash = await hashPassword(password, matched.salt);
      if (computedHash !== matched.passwordHash) {
        throw new Error("Mật khẩu không chính xác! Vui lòng thử lại.");
      }
      matched.lastLoginAt = now;
      saveLocalUsers(localUsers);
      verifiedUser = {
        nickname: matched.nickname,
        displayName: matched.displayName,
        createdAt: matched.createdAt,
        lastLoginAt: now,
        hasPassword: true,
      };
    }
  }

  if (!verifiedUser) {
    throw new Error(`Tài khoản '${cleanNick}' không tồn tại! Hãy kiểm tra lại hoặc chuyển sang tab 'Đăng ký mới'.`);
  }

  // Lưu active session
  if (typeof window !== "undefined") {
    localStorage.setItem("ict_active_user", verifiedUser.nickname);
    const existing = await fetchUsers();
    const filtered = existing.filter((u) => u.nickname !== verifiedUser!.nickname);
    localStorage.setItem("ict_recent_users", JSON.stringify([verifiedUser, ...filtered].slice(0, 8)));
  }

  return verifiedUser;
}

/**
 * Đăng xuất tài khoản
 */
export function logoutUser(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("ict_active_user");
  }
}

/**
 * Tương thích ngược với các lệnh khởi tạo tự động cũ
 */
export async function registerOrLoginUser(nickname: string, displayName?: string): Promise<UserProfile> {
  const cleanNick = nickname.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!cleanNick) {
    throw new Error("Nickname không hợp lệ");
  }
  const name = displayName?.trim() || cleanNick;

  // Thử login với password mặc định nếu có, hoặc đăng ký
  try {
    return await loginUser(cleanNick, "123456");
  } catch {
    try {
      return await registerUser(cleanNick, "123456", name);
    } catch {
      return {
        nickname: cleanNick,
        displayName: name,
        lastLoginAt: new Date().toISOString(),
      };
    }
  }
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
      if (error) {
        const errorMsg = error.message || error.details || error.hint || (typeof error === "object" ? JSON.stringify(error) : String(error));
        console.warn("Lỗi lưu account Supabase (đầy đủ):", errorMsg);
        // Fallback tối giản nếu CSDL cũ chưa kịp chạy SQL migration
        const fallbackRow = {
          id: accWithUser.id,
          name: accWithUser.name,
          prop_firm: accWithUser.propFirm,
          account_type: accWithUser.accountType,
          balance: accWithUser.balance,
          mll: accWithUser.mll,
          mdl: accWithUser.mdl,
          target: accWithUser.target,
          status: accWithUser.status,
        };
        const fbRes = await sb.from("accounts").upsert(fallbackRow);
        if (fbRes.error) {
          console.warn("Lỗi lưu account Supabase (tối giản):", fbRes.error.message || fbRes.error.details || fbRes.error);
        }
      }

      // Tự động liên kết tài khoản này vào user_config nếu user_config chưa có active_account_id
      try {
        const { data: userCfg } = await sb.from("user_config").select("active_account_id").eq("id", userNick).maybeSingle();
        if (!userCfg || !userCfg.active_account_id) {
          await sb.from("user_config").upsert({
            id: userNick,
            active_account_id: accWithUser.id,
            bal: accWithUser.balance,
            risk: accWithUser.riskPct || 0.5,
            max_t: accWithUser.maxTradesDaily || 3,
            max_l: accWithUser.maxLossRDaily || 2.0,
            updated_at: new Date().toISOString(),
          });
        }
      } catch {}
    } catch (e: any) {
      console.warn("Supabase insertAccount catch error:", e?.message || e);
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

export async function saveConfig(cfg: AppConfig, userNickname?: string): Promise<void> {
  const nick = userNickname || cfg.userNickname || (typeof window !== "undefined" ? localStorage.getItem("ict_active_user") : null);
  if (!nick) return;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`ictm_cfg_${nick}`, JSON.stringify(cfg));
    } catch {}
  }

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("user_config").upsert({
        id: nick,
        active_account_id: cfg.activeAccountId || null,
        bal: Number(cfg.bal) || 50000,
        risk: Number(cfg.risk) || 0.5,
        max_t: Number(cfg.maxT) || 3,
        max_l: Number(cfg.maxL) || 2.0,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.warn("Lỗi lưu user_config Supabase:", error.message || error.details || error);
      }
    } catch (e: any) {
      console.warn("Supabase save config error:", e?.message || e);
    }
  }
}
