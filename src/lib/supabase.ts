import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Trade, AppConfig } from "@/types";

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
    const { error } = await client.from("trades").select("id").limit(1);
    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return { success: false, message: "Kết nối thành công nhưng chưa tạo bảng 'trades'. Hãy chạy file supabase_schema.sql!" };
      }
      return { success: false, message: `Lỗi: ${error.message}` };
    }
    return { success: true, message: "Kết nối Supabase thành công! Dữ liệu đã sẵn sàng." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, message: `Lỗi kết nối: ${msg}` };
  }
}

export async function fetchTrades(): Promise<Trade[]> {
  const sb = getSupabase();
  if (!sb) {
    // Fallback to localStorage
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("ictm");
        if (local) {
          const parsed = JSON.parse(local);
          return parsed.trades || [];
        }
      } catch {}
    }
    return [];
  }

  try {
    const { data, error } = await sb.from("trades").select("*").order("time", { ascending: true });
    if (error) throw error;
    return (data as Trade[]) || [];
  } catch (err) {
    console.warn("Lỗi tải Supabase, dùng LocalStorage dự phòng:", err);
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("ictm");
        if (local) {
          const parsed = JSON.parse(local);
          return parsed.trades || [];
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
      const { error } = await sb.from("trades").upsert(trade);
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

export async function fetchConfig(): Promise<AppConfig> {
  const defaultConfig: AppConfig = { bal: 50000, risk: 0.5, maxT: 3, maxL: 2 };
  const sb = getSupabase();

  if (sb) {
    try {
      const { data, error } = await sb.from("user_config").select("*").eq("id", "default").single();
      if (!error && data) {
        return {
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
