"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Trade, AppConfig, MacroSession, PropAccount, AccountType, PropFirm, AccountStatus, CFDPhase, UserProfile } from "@/types";
import { SES, CHK, PV, SETUPS, DEFAULT_ACCOUNTS, PROP_PRESETS, SQL_SCHEMA_SCRIPT } from "@/lib/constants";
import {
  fetchTrades,
  insertTrade,
  removeTrade,
  fetchConfig,
  saveConfig,
  fetchAccounts,
  insertAccount,
  removeAccount,
  fetchUsers,
  registerOrLoginUser,
  checkDatabaseHealth,
  saveSupabaseCredentials,
  DatabaseHealthStatus,
} from "@/lib/supabase";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"radar" | "prop" | "check" | "log" | "stat" | "cfg">("radar");

  // Database Connection & Initialization state
  const [dbHealth, setDbHealth] = useState<DatabaseHealthStatus | null>(null);
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [dbChecking, setDbChecking] = useState(false);
  const [sbUrlInput, setSbUrlInput] = useState("");
  const [sbKeyInput, setSbKeyInput] = useState("");
  const [copiedSql, setCopiedSql] = useState(false);
  const [initNickInput, setInitNickInput] = useState("trader_real");
  const [initPresetIdx, setInitPresetIdx] = useState(0);

  // User Profile state (Null until authenticated with real database)
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [loginNickInput, setLoginNickInput] = useState("");
  const [loginNameInput, setLoginNameInput] = useState("");

  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<PropAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>("");
  const [accFilter, setAccFilter] = useState<string>("all");
  const [cfg, setCfg] = useState<AppConfig>({ bal: 50000, risk: 0.5, maxT: 3, maxL: 2 });
  const [chk, setChk] = useState<boolean[]>(CHK.map(() => false));
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Account Modal state
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accForm, setAccForm] = useState({
    name: "Topstep 50K Combine",
    propFirm: "topstep" as PropFirm,
    accountType: "futures" as AccountType,
    balance: 50000,
    currentBalance: 50000,
    mll: 2000,
    mdl: 1000,
    target: 3000,
    status: "eval" as AccountStatus,
    consistencyPct: 50,
    riskPct: 0.5,
    maxTradesDaily: 3,
    maxLossRDaily: 2,
    currentPhase: 1,
    cfdPhases: [
      { phase: 1, name: "Vòng 1 (Challenge)", targetPct: 8, mdlPct: 5, mllPct: 10 },
      { phase: 2, name: "Vòng 2 (Verification)", targetPct: 5, mdlPct: 5, mllPct: 10 },
      { phase: 3, name: "Funded Live", targetPct: 0, mdlPct: 5, mllPct: 10 },
    ] as CFDPhase[],
  });

  // Calendar state
  const [calYear, setCalYear] = useState<number>(2026);
  const [calMonth, setCalMonth] = useState<number>(9);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [todayDateStr, setTodayDateStr] = useState<string>("");
  const [todayKey, setTodayKey] = useState<string>("");

  // Dialog & Trade Form state
  const [dlgOpen, setDlgOpen] = useState(false);
  const [tradeFormAccId, setTradeFormAccId] = useState<string>("");
  const [tradeForm, setTradeForm] = useState({
    pair: "MNQ",
    pv: 2,
    side: 1, // 1: Long, -1: Short
    ctr: 1,
    sess: "n1",
    setup: "Liquidity Sweep + FVG",
    entry: "",
    sl: "",
    tp: "",
    exit: "",
    notes: "",
    disc: true,
  });

  // Clocks & Live Time
  const [clocks, setClocks] = useState({
    nyTxt: "--:--:--",
    vnTxt: "--:--:--",
    nyMin: 0,
    vnMin: 0,
    dst: true,
    off: 11,
    seasonTxt: "Mùa hè Mỹ (EDT) · VN lệch +11h",
  });

  // Overlay Mouse Tracker to prevent modal from accidentally closing when selecting/dragging text
  const overlayMouseDownRef = React.useRef<EventTarget | null>(null);

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    overlayMouseDownRef.current = e.target;
  };

  const handleOverlayClick = (closeFn: () => void) => (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if BOTH mousedown and mouseup/click originated directly on the overlay backdrop itself
    if (e.target === e.currentTarget && overlayMouseDownRef.current === e.currentTarget) {
      closeFn();
    }
    overlayMouseDownRef.current = null;
  };

  // Run Database Health Check
  const runDbHealthCheck = async (customUrl?: string, customKey?: string) => {
    setDbChecking(true);
    const health = await checkDatabaseHealth(customUrl, customKey);
    setDbHealth(health);
    if (health.url) setSbUrlInput(health.url);
    if (health.anonKey) setSbKeyInput(health.anonKey);
    setDbChecking(false);

    // If database is not configured or missing tables, prompt initialization
    if (!health.connected || !health.allTablesReady) {
      setDbModalOpen(true);
    }
    return health;
  };

  // Test and Save Database Credentials
  const handleTestAndSaveDb = async () => {
    if (!sbUrlInput.trim() || !sbKeyInput.trim()) {
      alert("Vui lòng nhập đầy đủ Supabase URL và Anon Public Key!");
      return;
    }
    saveSupabaseCredentials(sbUrlInput, sbKeyInput);
    const health = await runDbHealthCheck(sbUrlInput, sbKeyInput);
    if (health.allTablesReady) {
      if (activeUser?.nickname) {
        await loadUserData(activeUser.nickname);
      }
    } else {
      alert(
        `Kết nối được nhưng CSDL còn thiếu bảng: ${health.missingTables.join(", ")}.\nVui lòng bấm 'Sao chép toàn bộ mã SQL' và chạy trong Supabase SQL Editor!`
      );
    }
  };

  // Complete Initial Database Setup (User & Account)
  const handleCompleteDbSetup = async () => {
    const nick = initNickInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || "trader_1";
    const preset = PROP_PRESETS[initPresetIdx] || PROP_PRESETS[0];

    // 1. Register User in Supabase
    const userProfile = await registerOrLoginUser(nick, nick);
    setActiveUser(userProfile);

    // 2. Create Initial Prop Account in Supabase
    const newAcc: PropAccount = {
      id: `ACC-${preset.firm.toUpperCase()}-${Date.now().toString().slice(-6)}`,
      userNickname: nick,
      name: preset.label,
      propFirm: preset.firm,
      accountType: preset.type,
      balance: preset.balance,
      currentBalance: preset.balance,
      mll: preset.mll,
      mdl: preset.mdl,
      target: preset.target,
      status: "eval",
      consistencyPct: preset.consistency || 50,
      riskPct: preset.riskPct || 0.5,
      maxTradesDaily: preset.maxTradesDaily || 3,
      maxLossRDaily: preset.maxLossRDaily || 2,
      currentPhase: 1,
      cfdPhases: preset.phases || [],
    };

    await insertAccount(newAcc);
    setAccounts([newAcc]);
    setActiveAccountId(newAcc.id);
    setTradeFormAccId(newAcc.id);

    // 3. Save initial config
    const newCfg: AppConfig = {
      userNickname: nick,
      activeAccountId: newAcc.id,
      bal: preset.balance,
      risk: preset.riskPct || 0.5,
      maxT: preset.maxTradesDaily || 3,
      maxL: preset.maxLossRDaily || 2,
    };
    setCfg(newCfg);
    await saveConfig(newCfg, nick);

    setDbModalOpen(false);
    alert(`Khởi tạo thành công! Dữ liệu của Trader '${nick}' đã được kết nối và lưu trữ trực tiếp trên Supabase.`);
  };

  // Load User Data helper
  const loadUserData = async (nickname: string, displayName?: string) => {
    if (!nickname) return;
    const userProfile = await registerOrLoginUser(nickname, displayName);
    setActiveUser(userProfile);

    const loadedRecent = await fetchUsers();
    setRecentUsers(loadedRecent);

    const loadedAccounts = await fetchAccounts(userProfile.nickname);
    setAccounts(loadedAccounts);

    let loadedCfg = await fetchConfig(userProfile.nickname);

    const initialActiveId = (loadedCfg.activeAccountId && loadedAccounts.some((a) => a.id === loadedCfg.activeAccountId))
      ? loadedCfg.activeAccountId
      : (loadedAccounts[0]?.id || "");
    setActiveAccountId(initialActiveId);
    setTradeFormAccId(initialActiveId);

    // Đồng bộ lưu user_config vào Supabase để bảng user_config không bị trống
    if (!loadedCfg.activeAccountId && initialActiveId) {
      loadedCfg = { ...loadedCfg, activeAccountId: initialActiveId };
      await saveConfig(loadedCfg, userProfile.nickname);
    }
    setCfg(loadedCfg);

    const loadedTrades = await fetchTrades(undefined, userProfile.nickname);
    setTrades(loadedTrades);
  };

  // Load initial data
  useEffect(() => {
    setMounted(true);
    const nw = new Date();
    setCalYear(nw.getFullYear());
    setCalMonth(nw.getMonth());
    setTodayDateStr(nw.toDateString());
    setTodayKey(`${nw.getFullYear()}-${String(nw.getMonth() + 1).padStart(2, "0")}-${String(nw.getDate()).padStart(2, "0")}`);

    // Check saved theme
    const savedTheme = localStorage.getItem("ict_theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }

    // 1. Dọn dẹp mock data cũ (demo_trader & DEFAULT_ACCOUNTS) khỏi LocalStorage nếu còn sót
    if (typeof window !== "undefined") {
      const storedNick = localStorage.getItem("ict_active_user");
      if (storedNick === "demo_trader") {
        localStorage.removeItem("ict_active_user");
        localStorage.removeItem("ict_accounts");
        localStorage.removeItem("ict_recent_users");
      }
    }

    // 2. Chạy kiểm tra CSDL thật và tải dữ liệu thật
    runDbHealthCheck().then(async (health) => {
      if (health.allTablesReady) {
        const existingUsers = await fetchUsers();
        setRecentUsers(existingUsers);

        const savedNick = typeof window !== "undefined" ? localStorage.getItem("ict_active_user") : null;

        if (savedNick && existingUsers.some((u) => u.nickname === savedNick)) {
          await loadUserData(savedNick);
        } else if (existingUsers.length > 0) {
          await loadUserData(existingUsers[0].nickname);
        } else {
          // Hoàn toàn chưa có người dùng nào trong CSDL thật!
          setActiveUser(null);
          setAccounts([]);
          setTrades([]);
          // Mở modal để người dùng khởi tạo Nickname của mình
          setUserModalOpen(true);
        }
      } else {
        setDbModalOpen(true);
      }
    });
  }, []);

  // Clocks loop
  useEffect(() => {
    function tick() {
      const now = new Date();
      // NY clock
      const nyParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      }).formatToParts(now);

      const nyMap: Record<string, string> = {};
      nyParts.forEach((p) => { nyMap[p.type] = p.value; });
      const nyH = Number(nyMap.hour) % 24;
      const nyM = Number(nyMap.minute);
      const nyS = nyMap.second;
      const isDst = nyMap.timeZoneName === "EDT";
      const off = isDst ? 11 : 12;

      // VN clock
      const vnH = (nyH + off) % 24;
      const vnTxt = `${String(vnH).padStart(2, "0")}:${String(nyM).padStart(2, "0")}:${nyS}`;
      const nyTxt = `${String(nyH).padStart(2, "0")}:${String(nyM).padStart(2, "0")}:${nyS}`;

      setClocks({
        nyTxt,
        vnTxt,
        nyMin: nyH * 60 + nyM,
        vnMin: vnH * 60 + nyM,
        dst: isDst,
        off,
        seasonTxt: isDst ? "Mùa hè Mỹ (EDT, UTC-4) · VN lệch +11h" : "Mùa đông Mỹ (EST, UTC-5) · VN lệch +12h",
      });
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Macro Sessions Context
  const macroCtx = useMemo<{ cur: MacroSession | null; nxt: MacroSession | null; wait: number }>(() => {
    let cur: MacroSession | null = null;
    let nxt: MacroSession | null = null;
    let best = 1e9;
    SES.forEach((x) => {
      if (clocks.nyMin >= x.s && clocks.nyMin < x.e) cur = x;
      const d = (x.s - clocks.nyMin + 1440) % 1440;
      if (d < best) {
        best = d;
        nxt = x;
      }
    });
    return { cur, nxt, wait: best };
  }, [clocks.nyMin]);

  const curSess = macroCtx.cur;
  const nxtSess = macroCtx.nxt;
  const waitMin = macroCtx.wait;

  // Active Prop Account
  const activeAcc = useMemo(() => {
    return accounts.find((a) => a.id === activeAccountId) || accounts[0] || null;
  }, [accounts, activeAccountId]);

  // Trades of the active account
  const activeAccTrades = useMemo(() => {
    if (!activeAcc) return trades;
    return trades.filter((t) => !t.accountId || t.accountId === activeAcc.id);
  }, [trades, activeAcc]);

  const activeAccNetPnl = useMemo(() => {
    return activeAccTrades.reduce((a, b) => a + b.pnl, 0);
  }, [activeAccTrades]);

  const curAccBalance = useMemo(() => {
    return (activeAcc?.balance ?? cfg.bal) + activeAccNetPnl;
  }, [activeAcc, cfg.bal, activeAccNetPnl]);

  // Today trades & guard based on active account
  const todayTrades = useMemo(() => {
    if (!todayDateStr) return [];
    return activeAccTrades.filter((t) => new Date(t.time).toDateString() === todayDateStr);
  }, [activeAccTrades, todayDateStr]);

  const todayPnl = useMemo(() => todayTrades.reduce((a, x) => a + x.pnl, 0), [todayTrades]);
  const todayR = useMemo(() => todayTrades.reduce((a, x) => a + x.r, 0), [todayTrades]);

  // Limits & Risk Rules based on active account
  const activeMdl = activeAcc ? activeAcc.mdl : (cfg.maxL * cfg.bal * 0.01);
  const activeMll = activeAcc ? activeAcc.mll : 2000;
  const activeMaxTrades = activeAcc?.maxTradesDaily ?? cfg.maxT ?? 3;
  const activeMaxLossR = activeAcc?.maxLossRDaily ?? cfg.maxL ?? 2;
  const activeRiskPct = activeAcc?.riskPct ?? cfg.risk ?? 0.5;

  const isDailyBreached = todayPnl <= -activeMdl;
  const isMllBreached = activeAccNetPnl <= -activeMll;
  const isTradeLimitReached = todayTrades.length >= activeMaxTrades;
  const isLossRReached = todayR <= -activeMaxLossR;
  const isLocked = isTradeLimitReached || isLossRReached || isDailyBreached || isMllBreached;

  // Checklist Validation Status
  const chkScore = useMemo(() => Math.round((chk.filter(Boolean).length / CHK.length) * 100), [chk]);
  const chkMissingRequired = useMemo(() => CHK.filter((x, i) => x.required && !chk[i]), [chk]);
  const isChecklistPassed = useMemo(() => chkScore >= 80 && chkMissingRequired.length === 0, [chkScore, chkMissingRequired]);

  // Toggle Theme
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("ict_theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // Helper date key
  const toDateKey = (ts: number | Date) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const fmtDateVN = (str: string) => {
    const [y, m, d] = str.split("-");
    return `${d}/${m}/${y}`;
  };

  const hm = (m: number) => {
    const normalized = ((Math.round(m) % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
  };

  const fmtR = (r: number) => `${r >= 0 ? "+" : ""}${r.toFixed(2)}R`;

  // Consistency calculation for Futures Funded accounts
  const getAccountConsistency = (acc: PropAccount) => {
    const accTradesList = trades.filter((t) => !t.accountId || t.accountId === acc.id);
    const dayProfits: Record<string, number> = {};
    accTradesList.forEach((t) => {
      const d = toDateKey(t.time);
      dayProfits[d] = (dayProfits[d] || 0) + t.pnl;
    });

    const winDays = Object.values(dayProfits).filter((p) => p > 0);
    const totalPositiveProfit = winDays.reduce((a, b) => a + b, 0);
    const maxDayProfit = winDays.length > 0 ? Math.max(...winDays) : 0;
    const consistencyPct = totalPositiveProfit > 0 ? (maxDayProfit / totalPositiveProfit) * 100 : 0;
    const maxAllowedPct = acc.consistencyPct || 50;
    const isConsistent = consistencyPct <= maxAllowedPct;
    return { maxDayProfit, totalPositiveProfit, consistencyPct, maxAllowedPct, isConsistent };
  };

  // Select Preset Handler
  const handleSelectPreset = (index: number) => {
    const p = PROP_PRESETS[index];
    if (!p) return;
    setAccForm({
      name: p.label,
      propFirm: p.firm,
      accountType: p.type,
      balance: p.balance,
      currentBalance: p.balance,
      mll: p.mll,
      mdl: p.mdl,
      target: p.target,
      status: "eval",
      consistencyPct: p.consistency || 50,
      riskPct: p.riskPct || 0.5,
      maxTradesDaily: p.maxTradesDaily || 3,
      maxLossRDaily: p.maxLossRDaily || 2,
      currentPhase: 1,
      cfdPhases: p.phases || [
        { phase: 1, name: "Vòng 1 (Challenge)", targetPct: 8, mdlPct: 5, mllPct: 10 },
        { phase: 2, name: "Vòng 2 (Verification)", targetPct: 5, mdlPct: 5, mllPct: 10 },
        { phase: 3, name: "Funded Live", targetPct: 0, mdlPct: 5, mllPct: 10 },
      ],
    });
  };

  // Switch User Handler
  const handleSwitchUser = async (nickname: string, displayName?: string) => {
    const cleanNick = nickname.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!cleanNick) {
      alert("Vui lòng nhập nickname hợp lệ (chữ, số, gạch dưới)!");
      return;
    }
    await loadUserData(cleanNick, displayName);
    setUserModalOpen(false);
    setLoginNickInput("");
    setLoginNameInput("");
  };

  // Select Active Account Handler
  const handleSelectActiveAccount = async (id: string) => {
    setActiveAccountId(id);
    setTradeFormAccId(id);
    const newCfg = { ...cfg, activeAccountId: id };
    setCfg(newCfg);
    if (activeUser?.nickname) {
      await saveConfig(newCfg, activeUser.nickname);
    }
  };

  // Save Account (Create or Update)
  const handleSaveAccount = async () => {
    if (!activeUser?.nickname) {
      alert("Vui lòng khởi tạo Nickname người dùng trước khi tạo tài khoản quỹ!");
      setUserModalOpen(true);
      return;
    }
    if (!accForm.name.trim()) {
      alert("Vui lòng nhập tên tài khoản!");
      return;
    }
    const id = editingAccountId || `ACC-${accForm.propFirm.toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const newAcc: PropAccount = {
      id,
      userNickname: activeUser.nickname,
      name: accForm.name,
      propFirm: accForm.propFirm,
      accountType: accForm.accountType,
      balance: Number(accForm.balance) || 50000,
      currentBalance: Number(accForm.currentBalance) || Number(accForm.balance) || 50000,
      mll: Number(accForm.mll) || 2000,
      mdl: Number(accForm.mdl) || 1000,
      target: Number(accForm.target) || 3000,
      status: accForm.status,
      consistencyPct: Number(accForm.consistencyPct) || 50,
      riskPct: Number(accForm.riskPct) || 0.5,
      maxTradesDaily: Number(accForm.maxTradesDaily) || 3,
      maxLossRDaily: Number(accForm.maxLossRDaily) || 2,
      currentPhase: Number(accForm.currentPhase) || 1,
      cfdPhases: accForm.accountType === "cfd" ? accForm.cfdPhases : [],
    };

    const updated = editingAccountId
      ? accounts.map((a) => (a.id === editingAccountId ? newAcc : a))
      : [...accounts, newAcc];

    setAccounts(updated);
    if (!editingAccountId || activeAccountId === id) {
      setActiveAccountId(id);
    }
    await insertAccount(newAcc);

    // Lưu user_config vào Supabase để bảng user_config không bị trống
    const updatedCfg: AppConfig = {
      ...cfg,
      userNickname: activeUser.nickname,
      activeAccountId: id,
      bal: Number(accForm.balance) || 50000,
      risk: Number(accForm.riskPct) || 0.5,
      maxT: Number(accForm.maxTradesDaily) || 3,
      maxL: Number(accForm.maxLossRDaily) || 2,
    };
    setCfg(updatedCfg);
    await saveConfig(updatedCfg, activeUser.nickname);

    setAccModalOpen(false);
    setEditingAccountId(null);
  };

  // Attempt New Trade Handler - Centralized Guard for ALL Entry Buttons
  const handleAttemptNewTrade = (sessionId?: string) => {
    // 0. Bắt buộc kết nối database dữ liệu thật trước khi sử dụng
    if (!dbHealth?.allTablesReady) {
      alert("Hệ thống chưa kết nối dữ liệu thật với Database Supabase!\nVui lòng hoàn tất khởi tạo Database trước khi giao dịch.");
      setDbModalOpen(true);
      return;
    }

    if (!activeUser?.nickname) {
      alert("Chưa có thông tin người dùng trong CSDL thật!\nVui lòng khởi tạo Nickname của bạn trước khi vào lệnh.");
      setUserModalOpen(true);
      return;
    }

    if (accounts.length === 0 || !activeAcc) {
      alert("Chưa có tài khoản quỹ nào trong Database thật!\nVui lòng khởi tạo tài khoản quỹ trước khi vào lệnh.");
      setTab("prop");
      setAccModalOpen(true);
      return;
    }

    // 1. Kiểm tra khóa lệnh do chạm giới hạn rủi ro / tài khoản
    if (isLocked) {
      let reason = "TÀI KHOẢN ĐANG BỊ KHÓA LỆNH:\n";
      if (isMllBreached) reason += `• Đã chạm mức lỗ tối đa tài khoản MLL (-$${activeMll.toLocaleString()})!\n`;
      if (isDailyBreached) reason += `• Đã chạm mức lỗ tối đa trong ngày MDL (-$${activeMdl.toLocaleString()})!\n`;
      if (isTradeLimitReached) reason += `• Đã đạt số lệnh tối đa cho phép trong ngày (${todayTrades.length}/${activeMaxTrades} lệnh)!\n`;
      if (isLossRReached) reason += `• Đã chạm mức lỗ tối đa trong ngày (${todayR.toFixed(1)}R / -${activeMaxLossR}R)!\n`;
      reason += "\nHãy bảo toàn vốn và nghỉ ngơi hôm nay!";
      alert(reason);
      setTab("check");
      return;
    }

    // 2. Bắt buộc kiểm tra trạng thái Checklist ICT
    if (!isChecklistPassed) {
      let msg = "CHƯA ĐẠT CHUẨN CHECKLIST VÀO LỆNH!\n\n";
      msg += `• Điểm checklist: ${chkScore}% (Yêu cầu tối thiểu: 80%)\n`;
      if (chkMissingRequired.length > 0) {
        msg += `• Các tiêu chí bắt buộc còn thiếu:\n`;
        chkMissingRequired.forEach((item) => {
          msg += `   - ${item.title}\n`;
        });
      }
      msg += "\nHệ thống tự động chuyển bạn sang tab 'Checklist & Kỷ luật' để rà soát trước khi vào lệnh.";
      alert(msg);
      setTab("check");
      return;
    }

    // 3. Đã đủ điều kiện an toàn: Mở form ghi lệnh
    setTradeForm((f) => ({
      ...f,
      sess: sessionId || f.sess,
      disc: true,
    }));
    setDlgOpen(true);
  };

  // Delete Account
  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa tài khoản quỹ này?")) return;
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);
    if (activeAccountId === id && updated.length > 0) {
      setActiveAccountId(updated[0].id);
    }
    await removeAccount(id);
  };

  // Calculated Real-time Values in Dialog
  const calcValues = useMemo(() => {
    const en = Number(tradeForm.entry);
    const sl = Number(tradeForm.sl);
    const ex = Number(tradeForm.exit);
    const ct = Number(tradeForm.ctr) || 1;
    if (!en || !sl || !ex) return { pts: 0, pnl: 0, r: 0 };
    const pts = (ex - en) * tradeForm.side;
    const risk = Math.abs(en - sl) || 1;
    const r = pts / risk;
    const pnl = pts * tradeForm.pv * ct;
    return { pts, pnl, r };
  }, [tradeForm]);

  // Handle Save Trade
  const handleSaveTrade = async () => {
    const en = Number(tradeForm.entry);
    const sl = Number(tradeForm.sl);
    const ex = Number(tradeForm.exit);
    const tp = Number(tradeForm.tp);
    if (!en || !sl || !ex) {
      alert("Vui lòng nhập đầy đủ giá vào, cắt lỗ và giá thoát!");
      return;
    }

    const pts = (ex - en) * tradeForm.side;
    const risk = Math.abs(en - sl) || 1;
    const r = pts / risk;
    const pnl = pts * tradeForm.pv * (Number(tradeForm.ctr) || 1);

    const targetAccId = tradeFormAccId || activeAccountId || accounts[0]?.id || "";

    const newTrade: Trade = {
      id: `TRD-${400 + trades.length + 1}`,
      userNickname: activeUser ? activeUser.nickname : "trader",
      accountId: targetAccId,
      pair: tradeForm.pair.toUpperCase(),
      pv: tradeForm.pv,
      side: tradeForm.side,
      ctr: Number(tradeForm.ctr) || 1,
      sess: tradeForm.sess,
      setup: tradeForm.setup,
      entry: en,
      sl: sl,
      tp: tp || en,
      exit: ex,
      pts,
      pnl,
      r,
      disc: tradeForm.disc,
      notes: tradeForm.notes,
      time: Date.now(),
    };

    const updated = [...trades, newTrade];
    setTrades(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("ictm", JSON.stringify({ trades: updated, cfg }));
    }
    await insertTrade(newTrade);
    setDlgOpen(false);
    setTab("log");
    setChk(CHK.map(() => false));
  };

  // Handle Delete Trade
  const handleDeleteTrade = async (id: string) => {
    const updated = trades.filter((t) => t.id !== id);
    setTrades(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("ictm", JSON.stringify({ trades: updated, cfg }));
    }
    await removeTrade(id);
  };

  // Handle Demo Data
  const handleLoadDemo = async () => {
    const rs = [2, -1, 1.5, -1, 2.5];
    const ss = ["n1", "n2", "n1", "n3", "n2"];
    const demoTrades: Trade[] = rs.map((r, i) => {
      const entry = 20000;
      const sl = 19982.5;
      const exit = 20000 + r * 17.5;
      const pts = (exit - entry);
      return {
        id: `TRD-${400 + trades.length + i + 1}`,
        pair: "MNQ",
        pv: 2,
        side: 1,
        ctr: 1,
        sess: ss[i],
        setup: "Liquidity Sweep + FVG",
        entry,
        sl,
        tp: 20035,
        exit,
        pts,
        pnl: pts * 2,
        r,
        disc: true,
        notes: "Lệnh demo mẫu kiểm tra hệ thống",
        time: Date.now() - (5 - i) * 864e5,
      };
    });

    const updated = [...trades, ...demoTrades];
    setTrades(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("ictm", JSON.stringify({ trades: updated, cfg }));
    }
    for (const t of demoTrades) {
      await insertTrade(t);
    }
    setTab("stat");
  };

  // Calendar calculations
  const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // Monday = 0

  const monthTrades = useMemo(() => {
    return trades.filter((t) => {
      const dt = new Date(t.time);
      return dt.getFullYear() === calYear && dt.getMonth() === calMonth;
    });
  }, [trades, calYear, calMonth]);

  const monthPnl = useMemo(() => monthTrades.reduce((a, x) => a + x.pnl, 0), [monthTrades]);
  const monthR = useMemo(() => monthTrades.reduce((a, x) => a + x.r, 0), [monthTrades]);

  const dayMap = useMemo(() => {
    const map: Record<number, Trade[]> = {};
    monthTrades.forEach((t) => {
      const dNum = new Date(t.time).getDate();
      if (!map[dNum]) map[dNum] = [];
      map[dNum].push(t);
    });
    return map;
  }, [monthTrades]);

  let winDays = 0;
  let lossDays = 0;
  Object.keys(dayMap).forEach((d) => {
    const p = dayMap[Number(d)].reduce((a, x) => a + x.pnl, 0);
    if (p > 0) winDays++;
    else if (p < 0) lossDays++;
  });

  // Selected Day Trades
  const selectedTrades = useMemo(() => {
    if (!selectedDay) return [];
    return trades.filter((t) => toDateKey(t.time) === selectedDay);
  }, [trades, selectedDay]);

  const selPnl = useMemo(() => selectedTrades.reduce((a, x) => a + x.pnl, 0), [selectedTrades]);
  const selR = useMemo(() => selectedTrades.reduce((a, x) => a + x.r, 0), [selectedTrades]);

  return (
    <div className="app-container">
      {/* Header */}
      <header>
        <div className="logo-wrap">
          <img src="/logo.png" alt="ICT Macro Radar Logo" className="brand-logo" />
          <div className="title-group">
            <h1>ICT Macro Radar</h1>
            <div className="sub-title">{clocks.seasonTxt}</div>
          </div>
        </div>

        {/* Prop Account Quick Switcher */}
        {accounts.length > 0 ? (
          <div className="account-header-bar">
            <span className="acc-header-label">Tài khoản đang chọn:</span>
            <div className="acc-header-controls">
              <select
                value={activeAccountId}
                onChange={(e) => handleSelectActiveAccount(e.target.value)}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.propFirm.toUpperCase()} - {acc.accountType.toUpperCase()})
                  </option>
                ))}
              </select>
              {activeAcc && (
                <div className="acc-header-badges">
                  <span className={`badge-tag badge-${activeAcc.accountType}`}>{activeAcc.accountType}</span>
                  <span className={`badge-tag badge-${activeAcc.status}`}>{activeAcc.status}</span>
                  <span className="mono acc-header-balance">
                    ${(curAccBalance).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className="account-header-bar empty"
            onClick={() => {
              if (!activeUser) {
                setUserModalOpen(true);
              } else {
                setTab("prop");
                setEditingAccountId(null);
                handleSelectPreset(0);
                setAccModalOpen(true);
              }
            }}
            title="Bấm để khởi tạo tài khoản quỹ đầu tiên"
          >
            <span className="acc-header-label">Quỹ:</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)" }}>+ Thêm tài khoản quỹ</span>
          </div>
        )}

        {/* User Nickname Profile Pill */}
        <div
          className="user-header-pill"
          onClick={() => {
            setLoginNickInput(activeUser?.nickname || "");
            setLoginNameInput(activeUser?.displayName || "");
            setUserModalOpen(true);
          }}
          title={activeUser ? "Bấm để đổi Nickname người dùng" : "Bấm để khởi tạo Nickname"}
          style={{ borderColor: !activeUser ? "var(--acc)" : undefined }}
        >
          <div className="user-avatar" style={{ background: !activeUser ? "var(--acc)" : undefined, color: !activeUser ? "#000" : undefined }}>
            {activeUser ? activeUser.nickname.slice(0, 2).toUpperCase() : "?"}
          </div>
          <div>
            <span style={{ fontSize: 10, color: "var(--mut)", display: "block", lineHeight: 1.1 }}>
              Trader:
            </span>
            <span className="user-nick-text">{activeUser ? activeUser.nickname : "Chưa khởi tạo"}</span>
          </div>
          <span className="badge-tag" style={{ background: !activeUser ? "var(--acc)" : "var(--s3)", color: !activeUser ? "#000" : "var(--mut)", marginLeft: 2, fontSize: 9 }}>
            {activeUser ? "Đổi" : "Khởi tạo"}
          </span>
        </div>

        {/* Database Real Data Indicator Pill */}
        <div
          className={`db-header-pill ${dbHealth?.allTablesReady ? "ready" : "warning"}`}
          onClick={() => setDbModalOpen(true)}
          title="Bấm để kiểm tra và khởi tạo Database Supabase"
        >
          <span className="db-dot" />
          <span>
            {dbHealth?.allTablesReady
              ? "Supabase: Dữ liệu thật"
              : dbChecking
              ? "Đang kiểm tra DB..."
              : "Supabase: Cần khởi tạo"}
          </span>
        </div>

        <div className="clocks-container" suppressHydrationWarning>
          <div className="clk-box" suppressHydrationWarning>
            <b suppressHydrationWarning>{mounted ? clocks.nyTxt : "--:--:--"}</b>
            <span>New York</span>
          </div>
          <div className="clk-box" suppressHydrationWarning>
            <b suppressHydrationWarning>{mounted ? clocks.vnTxt : "--:--:--"}</b>
            <span>Việt Nam</span>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title="Đổi giao diện Sáng / Tối">
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="tab-nav">
        <button className={tab === "radar" ? "active" : ""} onClick={() => setTab("radar")}>
          Radar giờ Macro
        </button>
        <button className={tab === "prop" ? "active" : ""} onClick={() => setTab("prop")}>
          Tài khoản quỹ ({accounts.length})
        </button>
        <button className={tab === "check" ? "active" : ""} onClick={() => setTab("check")}>
          Checklist & Kỷ luật
        </button>
        <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>
          Nhật ký ({trades.length})
        </button>
        <button className={tab === "stat" ? "active" : ""} onClick={() => setTab("stat")}>
          Hiệu suất & Lịch P&L
        </button>
        <button className={tab === "cfg" ? "active" : ""} onClick={() => setTab("cfg")}>
          Cài đặt
        </button>
      </nav>

      {/* TAB 1: RADAR */}
      {tab === "radar" && (
        <div>
          {curSess ? (
            <div className="now-banner live">
              <div>
                <div className="sub-title">ĐANG TRONG KHUNG MACRO</div>
                <div className="big">
                  {curSess.n} · còn {curSess.e - clocks.nyMin} phút
                </div>
              </div>
              <button
                className="btn primary"
                onClick={() => handleAttemptNewTrade(curSess.id)}
              >
                + Ghi lệnh Macro
              </button>
            </div>
          ) : (
            <div className="now-banner">
              <div>
                <div className="sub-title">NGOÀI KHUNG MACRO - HÃY KIÊN NHẪN</div>
                <div className="big">
                  Tiếp theo: {nxtSess?.n} sau {Math.floor(waitMin / 60)}g {waitMin % 60}ph
                </div>
              </div>
              <div className="mono sub-title" style={{ fontSize: "14px" }}>
                VN {hm((nxtSess?.s || 0) + clocks.off * 60)}
              </div>
            </div>
          )}

          {/* 24h Timeline */}
          <div className="panel">
            <h2>Dòng thời gian 24 Giờ theo Giờ Việt Nam</h2>
            <div className="sub-title">Các khối màu hổ phách là ba khung NY AM quan trọng nhất (quét thanh khoản & mở sàn).</div>
            <div className="tl-container">
              {SES.map((x) => {
                const left = (((x.s + clocks.off * 60) % 1440) / 14.4);
                const width = Math.max((x.e - x.s) / 14.4, 0.6);
                return (
                  <i
                    key={x.id}
                    className={x.k ? "key-session" : ""}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${x.n} (${hm(x.s + clocks.off * 60)} - ${hm(x.e + clocks.off * 60)})`}
                  />
                );
              })}
              <div className="tl-cursor" style={{ left: `${clocks.vnMin / 14.4}%` }} />
            </div>
            <div className="ticks">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
          </div>

          {/* Table Sessions */}
          <div className="panel">
            <h2>Bảng quy đổi 10 phiên Macro</h2>
            <div className="sub-title" style={{ marginBottom: "14px" }}>
              Tự động cập nhật theo múi giờ New York ({clocks.dst ? "Mùa hè EDT lệch +11h" : "Mùa đông EST lệch +12h"}).
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Phiên Macro</th>
                    <th>New York</th>
                    <th>Giờ VN hiện tại</th>
                    <th>Mục tiêu thanh khoản</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {SES.map((x) => {
                    const isAct = curSess?.id === x.id;
                    return (
                      <tr key={x.id} style={isAct ? { background: "var(--accb)" } : {}}>
                        <td>
                          <b>{x.n}</b>
                          {x.k && <span className="tag gold" style={{ marginLeft: "8px" }}>Key Macro</span>}
                        </td>
                        <td className="mono sub-title">{hm(x.s)} – {hm(x.e)}</td>
                        <td className="mono" style={{ fontWeight: 600 }}>
                          {hm(x.s + clocks.off * 60)} – {hm(x.e + clocks.off * 60)}
                        </td>
                        <td>{x.m}</td>
                        <td>
                          <button
                            className={`btn ${x.k ? "primary" : ""}`}
                            onClick={() => handleAttemptNewTrade(x.id)}
                          >
                            + Ghi lệnh
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: TÀI KHOẢN QUÝ (PROP FIRM ACCOUNTS) */}
      {tab === "prop" && (
        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header">
              <div>
                <h2>Quản lý tài khoản quỹ (Prop Firm)</h2>
                <div className="sub-title">
                  Hỗ trợ 2 loại Futures & CFD (Topstep, Bulenox, The5ers). Tùy chỉnh MLL, MDL, Target, mốc Consistency (Futures Funded) và các vòng thi CFD.
                </div>
              </div>
              <button
                className="btn primary"
                onClick={() => {
                  setEditingAccountId(null);
                  handleSelectPreset(0);
                  setAccModalOpen(true);
                }}
              >
                + Thêm tài khoản quỹ
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid4" style={{ marginTop: 16 }}>
              <div className="stat-card">
                <span>Tổng số tài khoản</span>
                <b>{accounts.length}</b>
                <small>
                  {accounts.filter((a) => a.accountType === "futures").length} Futures · {accounts.filter((a) => a.accountType === "cfd").length} CFD
                </small>
              </div>
              <div className="stat-card">
                <span>Tài khoản đang chọn</span>
                <b style={{ fontSize: 16 }}>{activeAcc?.name || "Chưa chọn"}</b>
                <small>
                  {activeAcc ? `${activeAcc.propFirm.toUpperCase()} · ${activeAcc.accountType.toUpperCase()} · ${activeAcc.status.toUpperCase()}` : "--"}
                </small>
              </div>
              <div className="stat-card">
                <span>Tổng quy mô vốn quỹ</span>
                <b className="mono">${accounts.reduce((a, b) => a + b.balance, 0).toLocaleString()}</b>
                <small>{accounts.filter((a) => a.status === "funded").length} tài khoản Funded Live</small>
              </div>
              <div className="stat-card">
                <span>P&L tài khoản hiện tại</span>
                <b className={`mono ${activeAccNetPnl >= 0 ? "up" : "dn"}`}>
                  {activeAccNetPnl >= 0 ? "+" : ""}${activeAccNetPnl.toFixed(0)}
                </b>
                <small>Số dư: ${curAccBalance.toLocaleString()}</small>
              </div>
            </div>
          </div>

          {/* Accounts Grid */}
          <div className="acc-grid">
            {accounts.length === 0 ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "48px 24px",
                  textAlign: "center",
                  background: "var(--s1)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px dashed var(--line)",
                }}
              >
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--tx)", marginBottom: "8px" }}>
                  Chưa có tài khoản quỹ nào
                </div>
                <p style={{ color: "var(--mut)", fontSize: "13px", maxWidth: "520px", margin: "0 auto 20px" }}>
                  {activeUser ? (
                    <>Tài khoản của Nickname <b>{activeUser.nickname}</b> chưa có dữ liệu tài khoản quỹ nào trong Database thật. Hãy thêm tài khoản đầu tiên để bắt đầu theo dõi MLL, MDL và Target.</>
                  ) : (
                    <>CSDL thật chưa có tài khoản quỹ nào. Vui lòng khởi tạo Nickname trước khi tạo tài khoản quỹ.</>
                  )}
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setEditingAccountId(null);
                      handleSelectPreset(0);
                      setAccModalOpen(true);
                    }}
                  >
                    + Thêm tài khoản quỹ
                  </button>
                  <button className="btn" onClick={() => setDbModalOpen(true)}>
                    Khởi tạo từ Database Setup
                  </button>
                </div>
              </div>
            ) : (
              accounts.map((acc) => {
              const isActive = acc.id === activeAccountId;
              const accTradesList = trades.filter((t) => !t.accountId || t.accountId === acc.id);
              const netPnl = accTradesList.reduce((a, b) => a + b.pnl, 0);
              const curBal = acc.balance + netPnl;
              const pnlPct = acc.balance ? (netPnl / acc.balance) * 100 : 0;

              // Target progress
              const targetPct = acc.target > 0 ? Math.min(100, Math.max(0, (netPnl / acc.target) * 100)) : 0;

              // MLL buffer
              const maxDrawdown = accTradesList.length > 0 ? Math.max(0, -netPnl) : 0;
              const mllBuffer = Math.max(0, acc.mll - maxDrawdown);
              const mllPctUsed = Math.min(100, (maxDrawdown / acc.mll) * 100);

              // MDL today buffer
              const accTodayTrades = accTradesList.filter((t) => new Date(t.time).toDateString() === todayDateStr);
              const todayAccPnl = accTodayTrades.reduce((a, b) => a + b.pnl, 0);
              const todayLoss = Math.max(0, -todayAccPnl);
              const mdlBuffer = Math.max(0, acc.mdl - todayLoss);
              const mdlPctUsed = Math.min(100, (todayLoss / acc.mdl) * 100);

              // Consistency for Futures Funded
              const consistency = getAccountConsistency(acc);

              return (
                <div key={acc.id} className={`acc-card ${isActive ? "is-active" : ""}`}>
                  <div className="acc-card-top">
                    <div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: 6 }}>
                        <span className="acc-firm-label">{acc.propFirm}</span>
                        <span className={`badge-tag badge-${acc.accountType}`}>{acc.accountType}</span>
                        <span className={`badge-tag badge-${acc.status}`}>{acc.status}</span>
                      </div>
                      <div className="acc-card-title">{acc.name}</div>
                    </div>
                    {isActive && (
                      <span className="tag" style={{ background: "var(--blue)", color: "#fff", fontWeight: 700 }}>
                        Đang chọn
                      </span>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="acc-metrics-row">
                    <div>
                      <span>Vốn ban đầu</span>
                      <b className="mono">${acc.balance.toLocaleString()}</b>
                    </div>
                    <div>
                      <span>Số dư hiện tại</span>
                      <b className="mono">${curBal.toLocaleString()}</b>
                    </div>
                    <div>
                      <span>Lãi / Lỗ</span>
                      <b className={`mono ${netPnl >= 0 ? "up" : "dn"}`}>
                        {netPnl >= 0 ? "+" : ""}${netPnl.toFixed(0)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
                      </b>
                    </div>
                  </div>

                  {/* Account Discipline & Risk Settings Badge */}
                  <div style={{ background: "var(--s2)", padding: "6px 10px", borderRadius: "var(--radius-sm)", marginBottom: "12px", border: "1px solid var(--line)", fontSize: "11px", color: "var(--tx)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "4px" }}>
                    <span><b>Rủi ro:</b> {acc.riskPct || 0.5}%/lệnh (${(((acc.balance || 50000) * (acc.riskPct || 0.5)) / 100).toFixed(0)})</span>
                    <span><b>Tối đa:</b> {acc.maxTradesDaily || 3} lệnh/ngày</span>
                    <span><b>Max lỗ:</b> {acc.maxLossRDaily || 2}R/ngày</span>
                  </div>

                  {/* Progress Bars */}
                  <div className="acc-progress-list">
                    {/* Target */}
                    <div className="acc-progress-item">
                      <div className="acc-progress-label">
                        <span style={{ color: "var(--mut)" }}>Mục tiêu lợi nhuận (Target)</span>
                        <span className="mono">
                          ${Math.max(0, netPnl).toFixed(0)} / ${acc.target.toLocaleString()} ({targetPct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="acc-progress-track">
                        <div className="acc-progress-fill fill-target" style={{ width: `${targetPct}%` }} />
                      </div>
                    </div>

                    {/* MLL */}
                    <div className="acc-progress-item">
                      <div className="acc-progress-label">
                        <span style={{ color: "var(--mut)" }}>Giới hạn lỗ tối đa (MLL)</span>
                        <span className="mono" style={{ color: mllBuffer < acc.mll * 0.3 ? "var(--dn)" : "inherit" }}>
                          Còn buffer: ${mllBuffer.toFixed(0)} / ${acc.mll.toLocaleString()}
                        </span>
                      </div>
                      <div className="acc-progress-track">
                        <div className="acc-progress-fill fill-mll" style={{ width: `${mllPctUsed}%` }} />
                      </div>
                    </div>

                    {/* MDL */}
                    <div className="acc-progress-item">
                      <div className="acc-progress-label">
                        <span style={{ color: "var(--mut)" }}>Lỗ tối đa ngày (MDL)</span>
                        <span className="mono" style={{ color: mdlBuffer < acc.mdl * 0.3 ? "var(--dn)" : "inherit" }}>
                          Hôm nay còn: ${mdlBuffer.toFixed(0)} / ${acc.mdl.toLocaleString()}
                        </span>
                      </div>
                      <div className="acc-progress-track">
                        <div className="acc-progress-fill fill-mdl" style={{ width: `${mdlPctUsed}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Futures Funded Consistency Box */}
                  {acc.accountType === "futures" && acc.status === "funded" && (
                    <div className="acc-consistency-box">
                      <div className="acc-consistency-box-header">
                        <span>Quy tắc Consistency ({acc.consistencyPct || 50}%)</span>
                        <span className={consistency.isConsistent ? "up" : "dn"}>
                          {consistency.consistencyPct.toFixed(1)}% / {consistency.maxAllowedPct}%
                        </span>
                      </div>
                      <div className="sub-title">
                        Ngày lời cao nhất: ${consistency.maxDayProfit.toFixed(0)} / ${consistency.totalPositiveProfit.toFixed(0)} tổng lãi.
                      </div>
                      <div className={`acc-consistency-status ${consistency.isConsistent ? "up" : "dn"}`}>
                        {consistency.isConsistent
                          ? "Đạt chuẩn nhất quán (Dưới ngưỡng cho phép)."
                          : `Cảnh báo: Ngày lớn nhất chiếm ${consistency.consistencyPct.toFixed(1)}% (> ${consistency.maxAllowedPct}%). Cần thêm ngày giao dịch để cân bằng.`}
                      </div>
                    </div>
                  )}

                  {/* CFD Phase Table */}
                  {acc.accountType === "cfd" && acc.cfdPhases && acc.cfdPhases.length > 0 && (
                    <div className="acc-phase-box">
                      <div className="acc-phase-box-title">
                        Tiến độ các vòng CFD (Đang ở Vòng {acc.currentPhase || 1})
                      </div>
                      <table className="acc-phase-table">
                        <thead>
                          <tr>
                            <th>Vòng thi</th>
                            <th>Target %</th>
                            <th>MDL %</th>
                            <th>MLL %</th>
                            <th>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {acc.cfdPhases.map((ph) => {
                            const isCurrent = (acc.currentPhase || 1) === ph.phase;
                            const isPast = (acc.currentPhase || 1) > ph.phase;
                            return (
                              <tr key={ph.phase} className={isCurrent ? "active-phase" : ""}>
                                <td>{ph.name}</td>
                                <td className="mono">{ph.targetPct > 0 ? `+${ph.targetPct}%` : "Funded Live"}</td>
                                <td className="mono">{ph.mdlPct}%</td>
                                <td className="mono">{ph.mllPct}%</td>
                                <td>
                                  {isCurrent ? (
                                    <span className="tag" style={{ background: "var(--blue)", color: "#fff" }}>Đang thi</span>
                                  ) : isPast ? (
                                    <span className="tag" style={{ background: "var(--up-bg)", color: "var(--up)" }}>Đã qua</span>
                                  ) : (
                                    <span className="sub-title">Chưa tới</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Footer Buttons */}
                  <div className="acc-card-footer">
                    <div>
                      {!isActive && (
                        <button
                          className="btn primary"
                          onClick={() => handleSelectActiveAccount(acc.id)}
                        >
                          Chọn giao dịch
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="btn"
                        onClick={() => {
                          setEditingAccountId(acc.id);
                          setAccForm({
                            name: acc.name,
                            propFirm: acc.propFirm,
                            accountType: acc.accountType,
                            balance: acc.balance,
                            currentBalance: acc.currentBalance ?? acc.balance,
                            mll: acc.mll,
                            mdl: acc.mdl,
                            target: acc.target,
                            status: acc.status,
                            consistencyPct: acc.consistencyPct ?? 50,
                            riskPct: acc.riskPct ?? 0.5,
                            maxTradesDaily: acc.maxTradesDaily ?? 3,
                            maxLossRDaily: acc.maxLossRDaily ?? 2,
                            currentPhase: acc.currentPhase ?? 1,
                            cfdPhases: acc.cfdPhases && acc.cfdPhases.length > 0 ? acc.cfdPhases : [
                              { phase: 1, name: "Vòng 1 (Challenge)", targetPct: 8, mdlPct: 5, mllPct: 10 },
                              { phase: 2, name: "Vòng 2 (Verification)", targetPct: 5, mdlPct: 5, mllPct: 10 },
                              { phase: 3, name: "Funded Live", targetPct: 0, mdlPct: 5, mllPct: 10 },
                            ],
                          });
                          setAccModalOpen(true);
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        className="btn danger"
                        onClick={() => handleDeleteAccount(acc.id)}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* TAB 2: CHECKLIST */}
      {tab === "check" && (
        <div>
          <div className="grid4">
            <div className="stat-card">
              <span>Lệnh đã vào hôm nay</span>
              <b>{todayTrades.length} / {activeMaxTrades}</b>
              <small>Còn {Math.max(0, activeMaxTrades - todayTrades.length)} lệnh cho phép</small>
            </div>
            <div className="stat-card">
              <span>Tài khoản ({activeAcc?.propFirm.toUpperCase()})</span>
              <b style={{ fontSize: 16 }}>{activeAcc?.name || "Mặc định"}</b>
              <small>Vốn: ${(activeAcc?.balance || cfg.bal).toLocaleString()} · Rủi ro {activeRiskPct}%</small>
            </div>
            <div className="stat-card">
              <span>Lỗ tối đa ngày (MDL)</span>
              <b className={todayPnl < 0 ? "dn" : "up"}>
                {todayPnl >= 0 ? "+" : ""}${todayPnl.toFixed(0)}
              </b>
              <small>Còn buffer: ${Math.max(0, activeMdl - Math.max(0, -todayPnl)).toFixed(0)} / ${activeMdl.toLocaleString()}</small>
            </div>
            <div className="stat-card">
              <span>Trạng thái kiểm soát</span>
              <b className={isLocked ? "dn" : "up"}>
                {isDailyBreached
                  ? "Chạm MDL ngày!"
                  : isMllBreached
                  ? "Chạm MLL quỹ!"
                  : isTradeLimitReached
                  ? "Đạt giới hạn lệnh!"
                  : isLossRReached
                  ? "Chạm mức lỗ R!"
                  : "Sẵn sàng"}
              </b>
              <small>{isLocked ? "Đạt giới hạn rủi ro" : "Tuân thủ kỷ luật"}</small>
            </div>
          </div>

          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
              <div>
                <h2>Checklist ICT trước khi vào lệnh</h2>
                <div className="sub-title">
                  Tất cả các nút vào lệnh trong hệ thống đều tự động kiểm tra checklist này. Cần đạt tối thiểu 80% và hoàn thành đủ các tiêu chí bắt buộc.
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span
                  className="tag"
                  style={{
                    padding: "6px 12px",
                    fontWeight: 700,
                    fontSize: "12px",
                    background: isChecklistPassed ? "var(--up-bg)" : "var(--dn-bg)",
                    color: isChecklistPassed ? "var(--up)" : "var(--dn)",
                    border: `1px solid ${isChecklistPassed ? "var(--up)" : "var(--dn)"}`,
                  }}
                >
                  {isChecklistPassed ? `ĐẠT CHUẨN (${chkScore}%) · SẴN SÀNG VÀO LỆNH` : `CHƯA ĐẠT (${chkScore}%) · ĐANG BẢO VỆ LỆNH`}
                </span>
              </div>
            </div>

            {CHK.map((item, idx) => (
              <label
                key={idx}
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                  padding: "14px",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-md)",
                  marginBottom: "8px",
                  background: chk[idx] ? "var(--s2)" : "var(--s1)",
                  borderColor: chk[idx] ? "var(--up)" : "var(--line)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={chk[idx]}
                  onChange={(e) => {
                    const next = [...chk];
                    next[idx] = e.target.checked;
                    setChk(next);
                  }}
                  style={{ width: "20px", height: "20px", marginTop: "2px", accentColor: "var(--up)" }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14px" }}>
                    {item.title}
                    {item.required && <span className="tag" style={{ background: "var(--dn-bg)", color: "var(--dn)", marginLeft: "8px" }}>Bắt buộc</span>}
                  </div>
                  <div className="sub-title">{item.desc}</div>
                </div>
              </label>
            ))}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button className="btn" onClick={() => setChk(CHK.map(() => false))}>
                Làm mới
              </button>
              <button
                className="btn primary"
                disabled={isLocked || !isChecklistPassed}
                onClick={() => handleAttemptNewTrade()}
              >
                Đạt chuẩn: Ghi lệnh ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TRADE LOG */}
      {tab === "log" && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Nhật ký giao dịch</h2>
              <div className="sub-title">Toàn bộ lệnh đã ghi nhận và đồng bộ.</div>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <select
                value={accFilter}
                onChange={(e) => setAccFilter(e.target.value)}
                style={{
                  background: "var(--s2)",
                  border: "1px solid var(--line)",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--tx)",
                  fontSize: 13,
                }}
              >
                <option value="all">Tất cả tài khoản ({trades.length})</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({trades.filter((t) => t.accountId === a.id).length} lệnh)
                  </option>
                ))}
              </select>
              <button className="btn primary" onClick={() => handleAttemptNewTrade()}>
                + Thêm lệnh mới
              </button>
            </div>
          </div>

          {(() => {
            const filteredTrades = accFilter === "all"
              ? trades
              : trades.filter((t) => t.accountId === accFilter);

            if (!filteredTrades.length) {
              return (
                <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--mut)" }}>
                  Chưa có lệnh nào cho tài khoản này. Bạn có thể thêm lệnh mới hoặc tải dữ liệu mẫu trong mục Cài đặt.
                </div>
              );
            }

            return (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Mã Lệnh</th>
                      <th>Tài khoản</th>
                      <th>Cặp / HĐ</th>
                      <th>Vị thế</th>
                      <th>Phiên & Setup</th>
                      <th>Entry / SL / TP / Exit</th>
                      <th>Kết quả ($ & R)</th>
                      <th>Kỷ luật</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.slice().reverse().map((t) => {
                      const sess = SES.find((s) => s.id === t.sess) || SES[4];
                      const tradeAcc = accounts.find((a) => a.id === t.accountId);
                      return (
                        <tr key={t.id}>
                          <td>
                            <b className="mono">{t.id}</b>
                            <div className="sub-title">{new Date(t.time).toLocaleString("vi-VN")}</div>
                          </td>
                          <td>
                            {tradeAcc ? (
                              <div>
                                <span className={`badge-tag badge-${tradeAcc.accountType}`} style={{ marginRight: 4 }}>
                                  {tradeAcc.propFirm}
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 600 }}>{tradeAcc.name}</span>
                              </div>
                            ) : (
                              <span className="sub-title">Mặc định</span>
                            )}
                          </td>
                          <td>
                            <b>{t.pair}</b> <span className="tag">{t.ctr} hđ</span>
                          </td>
                          <td className={t.side > 0 ? "up" : "dn"}>
                            <b>{t.side > 0 ? "Mua (Long)" : "Bán (Short)"}</b>
                          </td>
                          <td>
                            <div>{sess.n}</div>
                            <div className="sub-title">{t.setup}</div>
                          </td>
                          <td className="mono sub-title" style={{ fontSize: "12px" }}>
                            V: {t.entry} | SL: {t.sl}
                            <br />
                            TP: {t.tp} | Thoát: {t.exit}
                          </td>
                          <td>
                            <b className={`mono ${t.r >= 0 ? "up" : "dn"}`}>{fmtR(t.r)}</b>
                            <div className="mono sub-title">${t.pnl.toFixed(0)}</div>
                          </td>
                          <td>
                            {t.disc ? (
                              <span className="tag" style={{ background: "var(--up-bg)", color: "var(--up)" }}>Đúng chuẩn</span>
                            ) : (
                              <span className="tag" style={{ background: "var(--dn-bg)", color: "var(--dn)" }}>Vi phạm</span>
                            )}
                          </td>
                          <td>
                            <button className="btn danger" onClick={() => handleDeleteTrade(t.id)}>
                              Xóa
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 4: PERFORMANCE & MONTHLY CALENDAR */}
      {tab === "stat" && (
        <div>
          {/* Top 4 Metrics */}
          {(() => {
            const totR = trades.reduce((a, x) => a + x.r, 0);
            const totPnl = trades.reduce((a, x) => a + x.pnl, 0);
            const winTrades = trades.filter((x) => x.r > 0);
            const wr = trades.length ? Math.round(winTrades.length / trades.length * 100) : 0;
            const grossProfit = winTrades.reduce((a, x) => a + x.r, 0);
            const grossLoss = Math.abs(trades.filter((x) => x.r < 0).reduce((a, x) => a + x.r, 0));
            const pf = grossLoss ? (grossProfit / grossLoss).toFixed(2) : (grossProfit ? "∞" : "0.00");
            const discCount = trades.filter((x) => x.disc).length;
            const discPct = trades.length ? Math.round(discCount / trades.length * 100) : 0;

            return (
              <div className="grid4">
                <div className="stat-card">
                  <span>Tổng lợi nhuận</span>
                  <b className={totR >= 0 ? "up" : "dn"}>{fmtR(totR)}</b>
                  <small>${totPnl.toFixed(0)}</small>
                </div>
                <div className="stat-card">
                  <span>Tỷ lệ thắng (Win Rate)</span>
                  <b>{wr}%</b>
                  <small>{winTrades.length} thắng · {trades.length - winTrades.length} thua</small>
                </div>
                <div className="stat-card">
                  <span>Profit Factor</span>
                  <b>{pf}</b>
                  <small>Tổng lãi / tổng lỗ (R)</small>
                </div>
                <div className="stat-card">
                  <span>Kỷ luật Macro</span>
                  <b>{discPct}%</b>
                  <small>{discCount}/{trades.length} lệnh chuẩn</small>
                </div>
              </div>
            );
          })()}

          {/* Monthly P&L Calendar */}
          <div className="panel">
            <div className="cal-head">
              <div className="cal-title-wrap">
                <h2 style={{ margin: 0 }}>Lịch P&L Tháng {calMonth + 1} / {calYear}</h2>
                <div className="cal-navs">
                  <button
                    className="cal-btn"
                    onClick={() => {
                      if (calMonth === 0) {
                        setCalMonth(11);
                        setCalYear((y) => y - 1);
                      } else {
                        setCalMonth((m) => m - 1);
                      }
                    }}
                    title="Tháng trước"
                  >
                    ‹
                  </button>
                  <button
                    className="cal-btn"
                    onClick={() => {
                      const nw = new Date();
                      setCalYear(nw.getFullYear());
                      setCalMonth(nw.getMonth());
                      setSelectedDay(toDateKey(nw));
                    }}
                    title="Về tháng hiện tại"
                  >
                    Hôm nay
                  </button>
                  <button
                    className="cal-btn"
                    onClick={() => {
                      if (calMonth === 11) {
                        setCalMonth(0);
                        setCalYear((y) => y + 1);
                      } else {
                        setCalMonth((m) => m + 1);
                      }
                    }}
                    title="Tháng sau"
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="cal-summary-chips">
                <span className="cal-chip">
                  P&L tháng: <b className={`mono ${monthPnl >= 0 ? "up" : "dn"}`}>{monthPnl >= 0 ? "+" : ""}${monthPnl.toFixed(0)} ({fmtR(monthR)})</b>
                </span>
                <span className="cal-chip"><b className="up">{winDays}</b> ngày thắng</span>
                <span className="cal-chip"><b className="dn">{lossDays}</b> ngày thua</span>
                <span className="cal-chip">Tổng: <b>{monthTrades.length}</b> lệnh</span>
              </div>
            </div>

            {/* Dow Header */}
            <div className="cal-grid" style={{ marginBottom: "6px" }}>
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((dow) => (
                <div key={dow} className="cal-dow">{dow}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="cal-grid">
              {/* Empty leading padding cells */}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`pad-${i}`} className="cal-cell empty-pad" />
              ))}

              {/* Day Cells */}
              {Array.from({ length: totalDays }).map((_, i) => {
                const dayNum = i + 1;
                const dayKey = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const dayTrades = dayMap[dayNum];
                const isToday = dayKey === todayKey;
                const isSelected = selectedDay === dayKey;

                if (dayTrades && dayTrades.length > 0) {
                  const pnl = dayTrades.reduce((a, x) => a + x.pnl, 0);
                  const r = dayTrades.reduce((a, x) => a + x.r, 0);
                  const cls = pnl > 0 ? "win" : pnl < 0 ? "loss" : "even";
                  const sign = pnl > 0 ? "+" : pnl < 0 ? "-" : "";

                  return (
                    <div
                      key={dayNum}
                      className={`cal-cell has-trades ${cls} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedDay(isSelected ? null : dayKey)}
                      title={`Ngày ${dayNum}: ${dayTrades.length} lệnh, P&L ${sign}$${Math.abs(pnl).toFixed(0)} (${fmtR(r)})`}
                    >
                      <div className="cal-cell-top">
                        <span className="cal-day-num">
                          {dayNum} {isToday && <small style={{ fontSize: "9px", fontWeight: 700 }}>Nay</small>}
                        </span>
                        <span className="cal-trade-count">{dayTrades.length} lệnh</span>
                      </div>
                      <div className="cal-cell-pnl">
                        <div className={`cal-cell-usd ${pnl >= 0 ? "up" : "dn"}`}>
                          {sign}${Math.abs(pnl).toFixed(0)}
                        </div>
                        <div className={`cal-cell-r ${r >= 0 ? "up" : "dn"}`}>{fmtR(r)}</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={dayNum}
                    className={`cal-cell ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setSelectedDay(isSelected ? null : dayKey)}
                    title={`Ngày ${dayNum}: Chưa có lệnh`}
                  >
                    <div className="cal-cell-top">
                      <span className="cal-day-num">
                        {dayNum} {isToday && <small style={{ fontSize: "9px", fontWeight: 700 }}>Nay</small>}
                      </span>
                    </div>
                    <div className="cal-cell-empty-val">-</div>
                  </div>
                );
              })}
            </div>

            {/* Selected Day Details Box */}
            {selectedDay && (
              <div className="cal-detail-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div>
                    <b>Chi tiết ngày {fmtDateVN(selectedDay)}</b> · <span className="sub-title">{selectedTrades.length} lệnh</span>
                    {selectedTrades.length > 0 && (
                      <span style={{ marginLeft: "10px" }}>
                        · Tổng P&L:{" "}
                        <b className={`mono ${selPnl >= 0 ? "up" : "dn"}`}>
                          {selPnl >= 0 ? "+" : ""}${selPnl.toFixed(0)} ({fmtR(selR)})
                        </b>
                      </span>
                    )}
                  </div>
                  <button className="btn" onClick={() => setSelectedDay(null)}>
                    Đóng
                  </button>
                </div>

                {!selectedTrades.length ? (
                  <div className="sub-title" style={{ padding: "8px 0" }}>
                    Không có lệnh nào trong ngày này.
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Lệnh</th>
                          <th>Cặp</th>
                          <th>Vị thế</th>
                          <th>Phiên / Setup</th>
                          <th>Giá</th>
                          <th>Kết quả</th>
                          <th>Kỷ luật</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTrades.map((t) => {
                          const s = SES.find((x) => x.id === t.sess) || SES[4];
                          return (
                            <tr key={t.id}>
                              <td>
                                <b className="mono">{t.id}</b>
                                <div className="sub-title">{new Date(t.time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</div>
                              </td>
                              <td><b>{t.pair}</b> <span className="tag">{t.ctr} hđ</span></td>
                              <td className={t.side > 0 ? "up" : "dn"}><b>{t.side > 0 ? "Mua" : "Bán"}</b></td>
                              <td>{s.n}<div className="sub-title">{t.setup}</div></td>
                              <td className="mono sub-title" style={{ fontSize: "12px" }}>
                                V: {t.entry} | SL: {t.sl}<br />
                                TP: {t.tp} | Thoát: {t.exit}
                              </td>
                              <td>
                                <b className={`mono ${t.r >= 0 ? "up" : "dn"}`}>{fmtR(t.r)}</b>
                                <div className="mono sub-title">${t.pnl.toFixed(0)}</div>
                              </td>
                              <td>{t.disc ? <span className="tag" style={{ background: "var(--up-bg)", color: "var(--up)" }}>Đúng chuẩn</span> : <span className="tag" style={{ background: "var(--dn-bg)", color: "var(--dn)" }}>Vi phạm</span>}</td>
                              <td>
                                <button className="btn danger" onClick={() => handleDeleteTrade(t.id)}>
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Equity Curve SVG */}
          {(() => {
            let cum = 0;
            const pts = [0, ...trades.map((x) => { cum += x.r; return cum; })];
            const mx = Math.max(...pts, 1);
            const mn = Math.min(...pts, 0);
            const rg = mx - mn || 1;
            const xy = pts.map((v, i) => [
              (pts.length > 1 ? i / (pts.length - 1) : 0) * 580 + 10,
              180 - ((v - mn) / rg) * 160,
            ]);
            const d = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
            const zeroY = 180 - ((0 - mn) / rg) * 160;

            return (
              <div className="panel">
                <h2>Đường vốn tích lũy theo R (Cumulative Equity)</h2>
                <div className="sub-title" style={{ marginBottom: "14px" }}>Biểu đồ tăng trưởng tài khoản theo số R đạt được.</div>
                <svg viewBox="0 0 600 200" width="100%" role="img" aria-label="Đường vốn tích lũy">
                  <line x1="10" x2="590" y1={zeroY} y2={zeroY} stroke="var(--line)" strokeDasharray="4" />
                  <path d={d} fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinejoin="round" />
                </svg>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 5: CONFIG & SUPABASE */}
      {tab === "cfg" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          {/* Risk settings - Per Prop Account */}
          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
              <h2>Quản lý rủi ro & Tài khoản quỹ</h2>
              {activeAcc && (
                <button
                  className="btn"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => {
                    setEditingAccountId(activeAcc.id);
                    setAccForm({
                      name: activeAcc.name,
                      propFirm: activeAcc.propFirm,
                      accountType: activeAcc.accountType,
                      balance: activeAcc.balance,
                      currentBalance: activeAcc.currentBalance ?? activeAcc.balance,
                      mll: activeAcc.mll,
                      mdl: activeAcc.mdl,
                      target: activeAcc.target,
                      status: activeAcc.status,
                      consistencyPct: activeAcc.consistencyPct ?? 50,
                      riskPct: activeAcc.riskPct ?? 0.5,
                      maxTradesDaily: activeAcc.maxTradesDaily ?? 3,
                      maxLossRDaily: activeAcc.maxLossRDaily ?? 2,
                      currentPhase: activeAcc.currentPhase ?? 1,
                      cfdPhases: activeAcc.cfdPhases && activeAcc.cfdPhases.length > 0 ? activeAcc.cfdPhases : [
                        { phase: 1, name: "Vòng 1 (Challenge)", targetPct: 8, mdlPct: 5, mllPct: 10 },
                        { phase: 2, name: "Vòng 2 (Verification)", targetPct: 5, mdlPct: 5, mllPct: 10 },
                        { phase: 3, name: "Funded Live", targetPct: 0, mdlPct: 5, mllPct: 10 },
                      ],
                    });
                    setAccModalOpen(true);
                  }}
                >
                  Sửa trong modal tài khoản
                </button>
              )}
            </div>
            <div className="sub-title">
              {activeAcc
                ? `Quy tắc rủi ro của tài khoản đang chọn: ${activeAcc.name} (${activeAcc.propFirm.toUpperCase()} - ${activeAcc.accountType.toUpperCase()})`
                : "Mỗi tài khoản quỹ được cấu hình riêng mức rủi ro, số lệnh và mức dừng lỗ tối đa."}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
              <div>
                <label>Số dư ban đầu ($)</label>
                <input
                  type="number"
                  value={activeAcc ? activeAcc.balance : cfg.bal}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    if (activeAcc) {
                      const updatedAcc = { ...activeAcc, balance: val };
                      setAccounts((prev) => prev.map((a) => (a.id === activeAcc.id ? updatedAcc : a)));
                    } else {
                      setCfg({ ...cfg, bal: val });
                    }
                  }}
                />
              </div>
              <div>
                <label>Rủi ro mỗi lệnh (% tài khoản)</label>
                <input
                  type="number"
                  step="0.1"
                  value={activeAcc ? (activeAcc.riskPct ?? 0.5) : cfg.risk}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0.5;
                    if (activeAcc) {
                      const updatedAcc = { ...activeAcc, riskPct: val };
                      setAccounts((prev) => prev.map((a) => (a.id === activeAcc.id ? updatedAcc : a)));
                    } else {
                      setCfg({ ...cfg, risk: val });
                    }
                  }}
                />
              </div>
              <div>
                <label>Số lệnh tối đa mỗi ngày</label>
                <input
                  type="number"
                  value={activeAcc ? (activeAcc.maxTradesDaily ?? 3) : cfg.maxT}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 3;
                    if (activeAcc) {
                      const updatedAcc = { ...activeAcc, maxTradesDaily: val };
                      setAccounts((prev) => prev.map((a) => (a.id === activeAcc.id ? updatedAcc : a)));
                    } else {
                      setCfg({ ...cfg, maxT: val });
                    }
                  }}
                />
              </div>
              <div>
                <label>Mức lỗ tối đa trong ngày (R)</label>
                <input
                  type="number"
                  step="0.5"
                  value={activeAcc ? (activeAcc.maxLossRDaily ?? 2) : cfg.maxL}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 2;
                    if (activeAcc) {
                      const updatedAcc = { ...activeAcc, maxLossRDaily: val };
                      setAccounts((prev) => prev.map((a) => (a.id === activeAcc.id ? updatedAcc : a)));
                    } else {
                      setCfg({ ...cfg, maxL: val });
                    }
                  }}
                />
              </div>
              <button
                className="btn primary"
                onClick={async () => {
                  if (activeAcc) {
                    await insertAccount(activeAcc);
                  }
                  if (typeof window !== "undefined") {
                    localStorage.setItem("ictm", JSON.stringify({ trades, cfg }));
                  }
                  if (activeUser?.nickname) {
                    await saveConfig(cfg, activeUser.nickname);
                  }
                  alert("Đã lưu cấu hình rủi ro tài khoản quỹ thành công!");
                }}
              >
                Lưu cấu hình
              </button>
            </div>
          </div>

          {/* Data panel */}
          <div className="panel">
            <h2>Dữ liệu</h2>
            <div className="sub-title" style={{ margin: "6px 0 16px" }}>
              Tải dữ liệu mẫu để kiểm tra lịch P&L hoặc xóa dữ liệu để bắt đầu lại.
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button className="btn" onClick={handleLoadDemo}>
                Tải dữ liệu mẫu
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lệnh?")) {
                    setTrades([]);
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("ictm");
                    }
                  }
                }}
              >
                Xóa toàn bộ lệnh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW TRADE DIALOG */}
      {dlgOpen && (
        <div
          className="modal-overlay"
          onMouseDown={handleOverlayMouseDown}
          onClick={handleOverlayClick(() => setDlgOpen(false))}
        >
          <div
            className="modal-content"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0 }}>Ghi lệnh giao dịch mới</h2>
              <button className="btn" onClick={() => setDlgOpen(false)}>Đóng</button>
            </div>

            {/* Account Selector */}
            {accounts.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <label>Tài khoản giao dịch</label>
                <select
                  value={tradeFormAccId || activeAccountId}
                  onChange={(e) => setTradeFormAccId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.propFirm.toUpperCase()} - {a.accountType.toUpperCase()} - {a.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: "12px" }}>
              <label>Cặp giao dịch</label>
              <input
                value={tradeForm.pair}
                onChange={(e) => {
                  const p = e.target.value.toUpperCase();
                  setTradeForm({ ...tradeForm, pair: p, pv: PV[p] || 1 });
                }}
              />
              <div className="chips">
                {Object.keys(PV).map((k) => (
                  <button
                    key={k}
                    className={tradeForm.pair === k ? "active" : ""}
                    onClick={() => setTradeForm({ ...tradeForm, pair: k, pv: PV[k] })}
                  >
                    {k} (${PV[k]}/điểm)
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>Vị thế</label>
              <div className="side-toggle">
                <button
                  className={tradeForm.side === 1 ? "active-long" : ""}
                  onClick={() => setTradeForm({ ...tradeForm, side: 1 })}
                >
                  Mua (Long)
                </button>
                <button
                  className={tradeForm.side === -1 ? "active-short" : ""}
                  onClick={() => setTradeForm({ ...tradeForm, side: -1 })}
                >
                  Bán (Short)
                </button>
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label>Số hợp đồng</label>
                <input
                  type="number"
                  min="1"
                  value={tradeForm.ctr}
                  onChange={(e) => setTradeForm({ ...tradeForm, ctr: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label>Phiên Macro</label>
                <select
                  value={tradeForm.sess}
                  onChange={(e) => setTradeForm({ ...tradeForm, sess: e.target.value })}
                >
                  {SES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Setup</label>
                <select
                  value={tradeForm.setup}
                  onChange={(e) => setTradeForm({ ...tradeForm, setup: e.target.value })}
                >
                  {SETUPS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label>Giá vào (Entry)</label>
                <input
                  type="number"
                  step="any"
                  value={tradeForm.entry}
                  onChange={(e) => setTradeForm({ ...tradeForm, entry: e.target.value })}
                />
              </div>
              <div>
                <label>Cắt lỗ (Stop Loss)</label>
                <input
                  type="number"
                  step="any"
                  value={tradeForm.sl}
                  onChange={(e) => setTradeForm({ ...tradeForm, sl: e.target.value })}
                />
              </div>
              <div>
                <label>Chốt lời (Take Profit)</label>
                <input
                  type="number"
                  step="any"
                  value={tradeForm.tp}
                  onChange={(e) => setTradeForm({ ...tradeForm, tp: e.target.value })}
                />
              </div>
              <div>
                <label>Giá thoát (Exit)</label>
                <input
                  type="number"
                  step="any"
                  value={tradeForm.exit}
                  onChange={(e) => setTradeForm({ ...tradeForm, exit: e.target.value })}
                />
              </div>
            </div>

            {/* Live Real-time Calculation */}
            <div className="calc-box">
              <div>
                <span>Điểm</span>
                <b className={`mono ${calcValues.pts >= 0 ? "up" : "dn"}`}>
                  {calcValues.pts.toFixed(2)}
                </b>
              </div>
              <div>
                <span>Lãi / Lỗ ($)</span>
                <b className={`mono ${calcValues.pnl >= 0 ? "up" : "dn"}`}>
                  ${calcValues.pnl.toFixed(0)}
                </b>
              </div>
              <div>
                <span>Kết quả (R)</span>
                <b className={`mono ${calcValues.r >= 0 ? "up" : "dn"}`}>
                  {fmtR(calcValues.r)}
                </b>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label>Ghi chú lệnh</label>
              <textarea
                rows={3}
                placeholder="Lý do vào lệnh, bối cảnh D1/H1, cảm xúc tâm lý..."
                value={tradeForm.notes}
                onChange={(e) => setTradeForm({ ...tradeForm, notes: e.target.value })}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn" onClick={() => setDlgOpen(false)}>Hủy</button>
              <button className="btn primary" onClick={handleSaveTrade}>Lưu vào nhật ký</button>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT MODAL (CREATE / EDIT PROP ACCOUNT) */}
      {accModalOpen && (
        <div
          className="modal-overlay"
          onMouseDown={handleOverlayMouseDown}
          onClick={handleOverlayClick(() => setAccModalOpen(false))}
        >
          <div
            className="modal-content"
            style={{ maxWidth: "620px" }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0 }}>
                {editingAccountId ? "Chỉnh sửa tài khoản quỹ" : "Thêm tài khoản quỹ mới"}
              </h2>
              <button className="btn" onClick={() => setAccModalOpen(false)}>Đóng</button>
            </div>

            {/* Presets if creating new */}
            {!editingAccountId && (
              <div style={{ marginBottom: "14px" }}>
                <label>Chọn nhanh từ mẫu (Presets)</label>
                <select
                  defaultValue="-1"
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    if (idx >= 0) handleSelectPreset(idx);
                  }}
                >
                  <option value="-1">-- Tự cấu hình riêng (Custom) --</option>
                  {PROP_PRESETS.map((p, idx) => (
                    <option key={idx} value={idx}>
                      {p.label} ({p.type.toUpperCase()} · Vốn ${p.balance.toLocaleString()} · MLL ${p.mll} · MDL ${p.mdl})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-grid">
              <div>
                <label>Tên tài khoản</label>
                <input
                  value={accForm.name}
                  onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
                  placeholder="Ví dụ: Topstep 50K Combine #1"
                />
              </div>
              <div>
                <label>Quỹ tài trợ (Prop Firm)</label>
                <select
                  value={accForm.propFirm}
                  onChange={(e) => setAccForm({ ...accForm, propFirm: e.target.value as PropFirm })}
                >
                  <option value="topstep">Topstep (Futures)</option>
                  <option value="bulenox">Bulenox (Futures)</option>
                  <option value="the5ers">The5ers (CFD)</option>
                  <option value="other">Quỹ khác</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label>Loại tài khoản</label>
                <select
                  value={accForm.accountType}
                  onChange={(e) => setAccForm({ ...accForm, accountType: e.target.value as AccountType })}
                >
                  <option value="futures">Futures</option>
                  <option value="cfd">CFD</option>
                </select>
              </div>
              <div>
                <label>Trạng thái</label>
                <select
                  value={accForm.status}
                  onChange={(e) => setAccForm({ ...accForm, status: e.target.value as AccountStatus })}
                >
                  <option value="eval">Đang thi (Evaluation)</option>
                  <option value="funded">Funded Live (Đã cấp vốn)</option>
                  <option value="passed">Đã đậu vòng (Passed)</option>
                  <option value="breached">Vi phạm quy tắc (Breached)</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label>Kích thước tài khoản ban đầu ($)</label>
                <input
                  type="number"
                  value={accForm.balance}
                  onChange={(e) => setAccForm({ ...accForm, balance: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label>Mục tiêu lợi nhuận Target ($)</label>
                <input
                  type="number"
                  value={accForm.target}
                  onChange={(e) => setAccForm({ ...accForm, target: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label>Giới hạn lỗ tối đa MLL ($)</label>
                <input
                  type="number"
                  value={accForm.mll}
                  onChange={(e) => setAccForm({ ...accForm, mll: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label>Giới hạn lỗ tối đa trong ngày MDL ($)</label>
                <input
                  type="number"
                  value={accForm.mdl}
                  onChange={(e) => setAccForm({ ...accForm, mdl: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Risk Management & Discipline Settings */}
            <div style={{ background: "var(--s2)", padding: "14px", borderRadius: "var(--radius-sm)", marginBottom: "14px", border: "1px solid var(--line)" }}>
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                Quản lý rủi ro & Kỷ luật lệnh (Risk Management)
              </div>
              <div className="sub-title" style={{ marginBottom: "12px" }}>
                Cấu hình rủi ro mỗi lệnh, số lệnh tối đa và mức cắt lỗ tối đa trong ngày (R) cho tài khoản này.
              </div>
              <div className="form-grid">
                <div>
                  <label>Rủi ro mỗi lệnh (% tài khoản)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={accForm.riskPct}
                    onChange={(e) => setAccForm({ ...accForm, riskPct: Number(e.target.value) || 0.5 })}
                  />
                  <div className="sub-title" style={{ fontSize: 11, marginTop: 4 }}>
                    = ${(((accForm.balance || 50000) * (accForm.riskPct || 0.5)) / 100).toFixed(0)} / lệnh
                  </div>
                </div>
                <div>
                  <label>Số lệnh tối đa mỗi ngày</label>
                  <input
                    type="number"
                    min="1"
                    value={accForm.maxTradesDaily}
                    onChange={(e) => setAccForm({ ...accForm, maxTradesDaily: Number(e.target.value) || 3 })}
                  />
                  <div className="sub-title" style={{ fontSize: 11, marginTop: 4 }}>
                    Ngăn chặn overtrading
                  </div>
                </div>
                <div>
                  <label>Mức lỗ tối đa trong ngày (R)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={accForm.maxLossRDaily}
                    onChange={(e) => setAccForm({ ...accForm, maxLossRDaily: Number(e.target.value) || 2 })}
                  />
                  <div className="sub-title" style={{ fontSize: 11, marginTop: 4 }}>
                    Khóa mở lệnh khi chạm ngưỡng
                  </div>
                </div>
              </div>
            </div>

            {/* Futures Funded Consistency Settings */}
            {accForm.accountType === "futures" && (
              <div style={{ background: "var(--s2)", padding: "12px", borderRadius: "var(--radius-sm)", marginBottom: "14px", border: "1px solid var(--line)" }}>
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                  Mốc Consistency Rule (Nhất quán)
                </div>
                <div className="sub-title" style={{ marginBottom: "10px" }}>
                  Áp dụng cho tài khoản Funded: Không được để 1 ngày giao dịch có lợi nhuận vượt quá % tổng lợi nhuận (Topstep thường là 50%, Bulenox 40%).
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <label style={{ margin: 0, whiteSpace: "nowrap" }}>Mốc giới hạn (%):</label>
                  <input
                    type="number"
                    style={{ width: "100px" }}
                    value={accForm.consistencyPct}
                    onChange={(e) => setAccForm({ ...accForm, consistencyPct: Number(e.target.value) || 50 })}
                  />
                  <span className="sub-title">(Mặc định 50%)</span>
                </div>
              </div>
            )}

            {/* CFD Phases Configuration */}
            {accForm.accountType === "cfd" && (
              <div style={{ background: "var(--s2)", padding: "12px", borderRadius: "var(--radius-sm)", marginBottom: "14px", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ fontWeight: 700 }}>
                    Cấu hình các mốc % Target theo từng vòng CFD
                  </div>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "4px 8px", fontSize: "12px" }}
                    onClick={() => {
                      const nextPhaseNum = accForm.cfdPhases.length + 1;
                      setAccForm({
                        ...accForm,
                        cfdPhases: [
                          ...accForm.cfdPhases,
                          { phase: nextPhaseNum, name: `Vòng ${nextPhaseNum}`, targetPct: 5, mdlPct: 5, mllPct: 10 },
                        ],
                      });
                    }}
                  >
                    + Thêm vòng
                  </button>
                </div>

                <div style={{ marginBottom: "10px" }}>
                  <label>Vòng hiện tại đang thi</label>
                  <select
                    value={accForm.currentPhase}
                    onChange={(e) => setAccForm({ ...accForm, currentPhase: Number(e.target.value) || 1 })}
                  >
                    {accForm.cfdPhases.map((ph) => (
                      <option key={ph.phase} value={ph.phase}>
                        Vòng {ph.phase}: {ph.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sub-title" style={{ marginBottom: "8px" }}>
                  Danh sách vòng thi (Tên vòng | % Target | % MDL | % MLL):
                </div>

                {accForm.cfdPhases.map((ph, idx) => (
                  <div key={idx} className="phase-builder-row">
                    <input
                      value={ph.name}
                      placeholder="Tên vòng"
                      onChange={(e) => {
                        const updated = [...accForm.cfdPhases];
                        updated[idx].name = e.target.value;
                        setAccForm({ ...accForm, cfdPhases: updated });
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Target %"
                      value={ph.targetPct}
                      onChange={(e) => {
                        const updated = [...accForm.cfdPhases];
                        updated[idx].targetPct = Number(e.target.value) || 0;
                        setAccForm({ ...accForm, cfdPhases: updated });
                      }}
                    />
                    <input
                      type="number"
                      placeholder="MDL %"
                      value={ph.mdlPct}
                      onChange={(e) => {
                        const updated = [...accForm.cfdPhases];
                        updated[idx].mdlPct = Number(e.target.value) || 0;
                        setAccForm({ ...accForm, cfdPhases: updated });
                      }}
                    />
                    <input
                      type="number"
                      placeholder="MLL %"
                      value={ph.mllPct}
                      onChange={(e) => {
                        const updated = [...accForm.cfdPhases];
                        updated[idx].mllPct = Number(e.target.value) || 0;
                        setAccForm({ ...accForm, cfdPhases: updated });
                      }}
                    />
                    <button
                      type="button"
                      className="btn danger"
                      style={{ padding: "4px 8px", fontSize: "12px" }}
                      disabled={accForm.cfdPhases.length <= 1}
                      onClick={() => {
                        const updated = accForm.cfdPhases.filter((_, i) => i !== idx);
                        setAccForm({ ...accForm, cfdPhases: updated });
                      }}
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button className="btn" onClick={() => setAccModalOpen(false)}>Hủy</button>
              <button className="btn primary" onClick={handleSaveAccount}>
                {editingAccountId ? "Lưu thay đổi" : "Tạo tài khoản"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER LOGIN / SWITCH NICKNAME MODAL */}
      {userModalOpen && (
        <div
          className="modal-overlay"
          onMouseDown={handleOverlayMouseDown}
          onClick={handleOverlayClick(() => setUserModalOpen(false))}
        >
          <div
            className="modal-content"
            style={{ maxWidth: "480px" }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0 }}>
                {activeUser ? "Đổi Nickname Người Dùng" : "Khởi tạo Nickname Người Dùng"}
              </h2>
              {activeUser && <button className="btn" onClick={() => setUserModalOpen(false)}>Đóng</button>}
            </div>

            <div className="sub-title" style={{ marginBottom: "16px" }}>
              {activeUser
                ? "Mỗi Nickname sẽ sở hữu các tài khoản quỹ (Prop Firm) và nhật ký giao dịch hoàn toàn riêng biệt."
                : "Hệ thống CSDL thật chưa có thông tin người dùng. Vui lòng nhập Nickname của bạn để bắt đầu khởi tạo tài khoản trên CSDL thật."}
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>Nickname người dùng</label>
              <input
                value={loginNickInput}
                onChange={(e) => setLoginNickInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                placeholder="Ví dụ: thien_ict, alex_trader..."
                autoFocus
              />
              <div className="sub-title" style={{ marginTop: "4px" }}>
                Chỉ gồm chữ cái viết thường, số, dấu gạch dưới `_` hoặc gạch ngang `-`.
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label>Tên hiển thị (Tùy chọn)</label>
              <input
                value={loginNameInput}
                onChange={(e) => setLoginNameInput(e.target.value)}
                placeholder="Ví dụ: Thiện ICT, Alex Trader..."
              />
            </div>

            {recentUsers.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <label>Tài khoản đã đăng nhập gần đây trên máy này:</label>
                <div className="recent-users-chips">
                  {recentUsers.map((u) => (
                    <button
                      key={u.nickname}
                      type="button"
                      className={`user-chip ${u.nickname === activeUser?.nickname ? "active" : ""}`}
                      onClick={() => handleSwitchUser(u.nickname, u.displayName)}
                    >
                      <span>{u.nickname}</span>
                      {u.displayName && u.displayName !== u.nickname && (
                        <span style={{ fontSize: 10, color: "var(--mut)" }}>({u.displayName})</span>
                      )}
                      {u.nickname === activeUser?.nickname && (
                        <span className="badge-tag badge-funded" style={{ fontSize: 9 }}>Đang dùng</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              {activeUser && <button className="btn" onClick={() => setUserModalOpen(false)}>Hủy</button>}
              <button
                className="btn primary"
                onClick={() => handleSwitchUser(loginNickInput, loginNameInput)}
              >
                {activeUser ? "Đăng nhập / Chuyển Nickname" : "Khởi tạo Nickname & Bắt đầu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPABASE DATABASE ONBOARDING & SETUP MODAL */}
      {dbModalOpen && (
        <div
          className="modal-overlay"
          onMouseDown={handleOverlayMouseDown}
          onClick={handleOverlayClick(() => setDbModalOpen(false))}
        >
          <div
            className="modal-content"
            style={{ maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className={`db-header-pill ${dbHealth?.allTablesReady ? "ready" : "warning"}`} style={{ padding: "4px 10px" }}>
                  <span className="db-dot" />
                  <span>{dbHealth?.allTablesReady ? "Dữ liệu thật đã sẵn sàng" : "Yêu cầu khởi tạo Database"}</span>
                </span>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Cơ sở dữ liệu Supabase</h2>
              </div>
              <button className="btn" onClick={() => setDbModalOpen(false)}>Đóng</button>
            </div>

            {/* Health status banner */}
            {dbHealth?.allTablesReady ? (
              <div
                style={{
                  background: "rgba(34, 197, 94, 0.1)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px 16px",
                  marginBottom: "20px",
                  fontSize: "13px",
                  color: "var(--tx)",
                }}
              >
                <div style={{ fontWeight: 700, color: "#22c55e", marginBottom: "4px" }}>
                  Kết nối thành công! Hệ thống đang hoạt động với CSDL thật.
                </div>
                <div style={{ color: "var(--mut)", fontSize: "12px" }}>
                  Tất cả 4 bảng (`users`, `accounts`, `trades`, `user_config`) đã được đồng bộ.
                  Hiện có <b>{dbHealth.userCount}</b> Trader, <b>{dbHealth.accountCount}</b> Tài khoản quỹ lưu trên Supabase.
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px 16px",
                  marginBottom: "20px",
                  fontSize: "13px",
                  color: "var(--tx)",
                }}
              >
                <div style={{ fontWeight: 700, color: "#f59e0b", marginBottom: "4px" }}>
                  Hệ thống yêu cầu khởi tạo CSDL thật trước khi sử dụng và vào lệnh.
                </div>
                <div style={{ color: "var(--mut)", fontSize: "12px" }}>
                  {dbHealth?.error ||
                    (dbHealth?.missingTables && dbHealth.missingTables.length > 0
                      ? `Thiếu các bảng: ${dbHealth.missingTables.join(", ")} trong CSDL Supabase.`
                      : "Chưa hoàn tất các bảng dữ liệu.")}
                </div>
              </div>
            )}

            {/* Section 1: Supabase Credentials */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px", color: "var(--tx)" }}>
                1. Thông tin kết nối Supabase
              </div>
              <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr" }}>
                <div>
                  <label>Supabase Project URL</label>
                  <input
                    value={sbUrlInput}
                    onChange={(e) => setSbUrlInput(e.target.value.trim())}
                    placeholder="https://xxxxxxxxxxxx.supabase.co"
                  />
                </div>
                <div>
                  <label>Supabase Anon Public API Key</label>
                  <input
                    type="password"
                    value={sbKeyInput}
                    onChange={(e) => setSbKeyInput(e.target.value.trim())}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  className="btn"
                  onClick={handleTestAndSaveDb}
                  disabled={dbChecking}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  {dbChecking ? "Đang kiểm tra kết nối..." : "Lưu & Kiểm tra kết nối lại"}
                </button>
              </div>
            </div>

            {/* Section 2: Tables Status Grid */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px", color: "var(--tx)" }}>
                2. Trạng thái các bảng dữ liệu
              </div>
              <div className="table-status-grid">
                <div className={`table-status-item ${dbHealth?.tables.users ? "ok" : "missing"}`}>
                  <div>
                    <b style={{ display: "block", fontSize: "13px" }}>users</b>
                    <small style={{ color: "var(--mut)" }}>Quản lý Nickname trader</small>
                  </div>
                  <span className={`badge-tag ${dbHealth?.tables.users ? "badge-funded" : "badge-eval"}`}>
                    {dbHealth?.tables.users ? "Đã sẵn sàng" : "Thiếu bảng"}
                  </span>
                </div>
                <div className={`table-status-item ${dbHealth?.tables.accounts ? "ok" : "missing"}`}>
                  <div>
                    <b style={{ display: "block", fontSize: "13px" }}>accounts</b>
                    <small style={{ color: "var(--mut)" }}>Tài khoản quỹ, MLL, MDL</small>
                  </div>
                  <span className={`badge-tag ${dbHealth?.tables.accounts ? "badge-funded" : "badge-eval"}`}>
                    {dbHealth?.tables.accounts ? "Đã sẵn sàng" : "Thiếu bảng"}
                  </span>
                </div>
                <div className={`table-status-item ${dbHealth?.tables.trades ? "ok" : "missing"}`}>
                  <div>
                    <b style={{ display: "block", fontSize: "13px" }}>trades</b>
                    <small style={{ color: "var(--mut)" }}>Nhật ký lệnh & P&L</small>
                  </div>
                  <span className={`badge-tag ${dbHealth?.tables.trades ? "badge-funded" : "badge-eval"}`}>
                    {dbHealth?.tables.trades ? "Đã sẵn sàng" : "Thiếu bảng"}
                  </span>
                </div>
                <div className={`table-status-item ${dbHealth?.tables.user_config ? "ok" : "missing"}`}>
                  <div>
                    <b style={{ display: "block", fontSize: "13px" }}>user_config</b>
                    <small style={{ color: "var(--mut)" }}>Kỷ luật & cài đặt cá nhân</small>
                  </div>
                  <span className={`badge-tag ${dbHealth?.tables.user_config ? "badge-funded" : "badge-eval"}`}>
                    {dbHealth?.tables.user_config ? "Đã sẵn sàng" : "Thiếu bảng"}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Missing Schema Setup Instructions */}
            {(!dbHealth?.allTablesReady || (dbHealth?.missingTables && dbHealth.missingTables.length > 0)) && (
              <div
                style={{
                  background: "var(--s1)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ fontWeight: 700, color: "var(--acc)", fontSize: "13px" }}>
                    Khởi tạo CSDL: Chạy kịch bản SQL trong Supabase
                  </div>
                  <button
                    className="btn primary"
                    onClick={() => {
                      navigator.clipboard.writeText(SQL_SCHEMA_SCRIPT);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 3000);
                    }}
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >
                    {copiedSql ? "Đã sao chép vào bộ nhớ!" : "Sao chép toàn bộ mã SQL"}
                  </button>
                </div>
                <ol style={{ fontSize: "12px", color: "var(--tx)", paddingLeft: "18px", margin: "0 0 12px", lineHeight: "1.6" }}>
                  <li>
                    Truy cập trang quản trị <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color: "var(--blue)", textDecoration: "underline" }}>Supabase Dashboard</a> và mở Project của bạn.
                  </li>
                  <li>
                    Nhấp vào mục <b>SQL Editor</b> trên thanh điều hướng bên trái, sau đó bấm <b>New query</b>.
                  </li>
                  <li>
                    Bấm <b>Sao chép toàn bộ mã SQL</b> ở trên, dán (Ctrl+V) vào ô soạn thảo và bấm nút <b>RUN</b> (phím tắt Ctrl+Enter).
                  </li>
                  <li>
                    Sau khi Supabase báo <i>Success</i>, quay lại đây và bấm nút <b>"Lưu & Kiểm tra kết nối lại"</b> ở trên.
                  </li>
                </ol>
                <div className="sql-code-box">
                  {SQL_SCHEMA_SCRIPT}
                </div>
              </div>
            )}

            {/* Section 4: Initial Seeding (Trader Nickname & First Account) */}
            {dbHealth?.allTablesReady && (
              <div
                style={{
                  background: "var(--s2)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "12px", color: "var(--tx)" }}>
                  Khởi tạo Trader & Tài khoản quỹ đầu tiên
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                  <div>
                    <label>Nickname Trader của bạn</label>
                    <input
                      value={initNickInput}
                      onChange={(e) => setInitNickInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      placeholder="Ví dụ: thien_ict"
                    />
                  </div>
                  <div>
                    <label>Gói quỹ ban đầu</label>
                    <select
                      value={initPresetIdx}
                      onChange={(e) => setInitPresetIdx(Number(e.target.value))}
                    >
                      {PROP_PRESETS.map((p, idx) => (
                        <option key={idx} value={idx}>
                          {p.label} - ${p.balance.toLocaleString()} ({p.type.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn primary" onClick={handleCompleteDbSetup}>
                    Khởi tạo dữ liệu thật & Bắt đầu giao dịch
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn" onClick={() => setDbModalOpen(false)}>Đóng</button>
              {dbHealth?.allTablesReady && (
                <button className="btn primary" onClick={() => setDbModalOpen(false)}>
                  Hoàn tất & Tiếp tục
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
