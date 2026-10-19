"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Trade, AppConfig, MacroSession, PropAccount, AccountType, PropFirm, AccountStatus, CFDPhase } from "@/types";
import { SES, CHK, PV, SETUPS, DEFAULT_ACCOUNTS, PROP_PRESETS } from "@/lib/constants";
import {
  fetchTrades,
  insertTrade,
  removeTrade,
  fetchConfig,
  saveConfig,
  fetchAccounts,
  insertAccount,
  removeAccount,
} from "@/lib/supabase";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"radar" | "prop" | "check" | "log" | "stat" | "cfg">("radar");
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

    // Load accounts, config & trades
    async function init() {
      const loadedAccounts = await fetchAccounts();
      setAccounts(loadedAccounts);

      const loadedCfg = await fetchConfig();
      setCfg(loadedCfg);

      const initialActiveId = (loadedCfg.activeAccountId && loadedAccounts.some(a => a.id === loadedCfg.activeAccountId))
        ? loadedCfg.activeAccountId
        : (loadedAccounts[0]?.id || "");
      setActiveAccountId(initialActiveId);
      setTradeFormAccId(initialActiveId);

      const loadedTrades = await fetchTrades();
      setTrades(loadedTrades);
    }
    init();
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

  // Limits
  const activeMdl = activeAcc ? activeAcc.mdl : (cfg.maxL * cfg.bal * 0.01);
  const activeMll = activeAcc ? activeAcc.mll : 2000;
  const isDailyBreached = todayPnl <= -activeMdl;
  const isMllBreached = activeAccNetPnl <= -activeMll;
  const isLocked = todayTrades.length >= cfg.maxT || todayR <= -cfg.maxL || isDailyBreached || isMllBreached;

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
      currentPhase: 1,
      cfdPhases: p.phases || [
        { phase: 1, name: "Vòng 1 (Challenge)", targetPct: 8, mdlPct: 5, mllPct: 10 },
        { phase: 2, name: "Vòng 2 (Verification)", targetPct: 5, mdlPct: 5, mllPct: 10 },
        { phase: 3, name: "Funded Live", targetPct: 0, mdlPct: 5, mllPct: 10 },
      ],
    });
  };

  // Select Active Account Handler
  const handleSelectActiveAccount = async (id: string) => {
    setActiveAccountId(id);
    setTradeFormAccId(id);
    const newCfg = { ...cfg, activeAccountId: id };
    setCfg(newCfg);
    await saveConfig(newCfg);
  };

  // Save Account (Create or Update)
  const handleSaveAccount = async () => {
    if (!accForm.name.trim()) {
      alert("Vui lòng nhập tên tài khoản!");
      return;
    }
    const id = editingAccountId || `ACC-${accForm.propFirm.toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const newAcc: PropAccount = {
      id,
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
    setAccModalOpen(false);
    setEditingAccountId(null);
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
        {accounts.length > 0 && (
          <div className="account-header-bar">
            <div>
              <span style={{ fontSize: 11, color: "var(--mut)", display: "block", marginBottom: 2 }}>Tài khoản đang chọn:</span>
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
            </div>
            {activeAcc && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span className={`badge-tag badge-${activeAcc.accountType}`}>{activeAcc.accountType}</span>
                <span className={`badge-tag badge-${activeAcc.status}`}>{activeAcc.status}</span>
                <span className="mono" style={{ fontWeight: 700, marginLeft: 4 }}>
                  ${(curAccBalance).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

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
                onClick={() => {
                  setTradeForm((f) => ({ ...f, sess: curSess.id, disc: true }));
                  setDlgOpen(true);
                }}
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
                            onClick={() => {
                              setTradeForm((f) => ({ ...f, sess: x.id, disc: true }));
                              setDlgOpen(true);
                            }}
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
            {accounts.map((acc) => {
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
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CHECKLIST */}
      {tab === "check" && (
        <div>
          <div className="grid4">
            <div className="stat-card">
              <span>Lệnh đã vào hôm nay</span>
              <b>{todayTrades.length} / {cfg.maxT}</b>
              <small>Còn {Math.max(0, cfg.maxT - todayTrades.length)} lệnh cho phép</small>
            </div>
            <div className="stat-card">
              <span>Tài khoản ({activeAcc?.propFirm.toUpperCase()})</span>
              <b style={{ fontSize: 16 }}>{activeAcc?.name || "Mặc định"}</b>
              <small>Vốn: ${(activeAcc?.balance || cfg.bal).toLocaleString()}</small>
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
                  : isLocked
                  ? "Đã khóa lệnh"
                  : "Sẵn sàng"}
              </b>
              <small>{isLocked ? "Đạt giới hạn rủi ro" : "Tuân thủ kỷ luật"}</small>
            </div>
          </div>

          <div className="panel">
            <h2>Checklist ICT trước khi vào lệnh</h2>
            <div className="sub-title" style={{ marginBottom: "16px" }}>
              Cần đạt tối thiểu 80% và hoàn thành toàn bộ các tiêu chí bắt buộc.
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
                disabled={
                  isLocked ||
                  Math.round(chk.filter(Boolean).length / CHK.length * 100) < 80 ||
                  !CHK.every((x, i) => !x.required || chk[i])
                }
                onClick={() => {
                  setTradeForm((f) => ({ ...f, disc: true }));
                  setDlgOpen(true);
                }}
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
              <button className="btn primary" onClick={() => setDlgOpen(true)}>
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
          {/* Risk settings */}
          <div className="panel">
            <h2>Quản lý rủi ro & Tài khoản</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
              <div>
                <label>Số dư ban đầu ($)</label>
                <input
                  type="number"
                  value={cfg.bal}
                  onChange={(e) => setCfg({ ...cfg, bal: Number(e.target.value) || 50000 })}
                />
              </div>
              <div>
                <label>Rủi ro mỗi lệnh (% tài khoản)</label>
                <input
                  type="number"
                  step="0.1"
                  value={cfg.risk}
                  onChange={(e) => setCfg({ ...cfg, risk: Number(e.target.value) || 0.5 })}
                />
              </div>
              <div>
                <label>Số lệnh tối đa mỗi ngày</label>
                <input
                  type="number"
                  value={cfg.maxT}
                  onChange={(e) => setCfg({ ...cfg, maxT: Number(e.target.value) || 3 })}
                />
              </div>
              <div>
                <label>Mức lỗ tối đa trong ngày (R)</label>
                <input
                  type="number"
                  step="0.5"
                  value={cfg.maxL}
                  onChange={(e) => setCfg({ ...cfg, maxL: Number(e.target.value) || 2 })}
                />
              </div>
              <button
                className="btn primary"
                onClick={async () => {
                  if (typeof window !== "undefined") {
                    localStorage.setItem("ictm", JSON.stringify({ trades, cfg }));
                  }
                  await saveConfig(cfg);
                  alert("Đã lưu cấu hình rủi ro!");
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
        <div className="modal-overlay" onClick={() => setDlgOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
        <div className="modal-overlay" onClick={() => setAccModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: "620px" }} onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}
