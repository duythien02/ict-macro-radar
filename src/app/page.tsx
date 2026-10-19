"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Trade, AppConfig, MacroSession } from "@/types";
import { SES, CHK, PV, SETUPS } from "@/lib/constants";
import {
  fetchTrades,
  insertTrade,
  removeTrade,
  fetchConfig,
  saveConfig,
} from "@/lib/supabase";

export default function Home() {
  const [tab, setTab] = useState<"radar" | "check" | "log" | "stat" | "cfg">("radar");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [cfg, setCfg] = useState<AppConfig>({ bal: 50000, risk: 0.5, maxT: 3, maxL: 2 });
  const [chk, setChk] = useState<boolean[]>(CHK.map(() => false));
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Calendar state
  const [calYear, setCalYear] = useState<number>(2026);
  const [calMonth, setCalMonth] = useState<number>(9);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [todayDateStr, setTodayDateStr] = useState<string>("");
  const [todayKey, setTodayKey] = useState<string>("");

  // Dialog & Trade Form state
  const [dlgOpen, setDlgOpen] = useState(false);
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

    // Load trades & config
    async function init() {
      const loadedCfg = await fetchConfig();
      setCfg(loadedCfg);

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

  // Today trades & guard
  const todayTrades = useMemo(() => {
    if (!todayDateStr) return [];
    return trades.filter((t) => new Date(t.time).toDateString() === todayDateStr);
  }, [trades, todayDateStr]);
  const todayR = useMemo(() => todayTrades.reduce((a, x) => a + x.r, 0), [todayTrades]);
  const isLocked = todayTrades.length >= cfg.maxT || todayR <= -cfg.maxL;

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

    const newTrade: Trade = {
      id: `TRD-${400 + trades.length + 1}`,
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

        <div className="clocks-container">
          <div className="clk-box">
            <b>{clocks.nyTxt}</b>
            <span>New York</span>
          </div>
          <div className="clk-box">
            <b>{clocks.vnTxt}</b>
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
              <span>Rủi ro mỗi lệnh</span>
              <b>{cfg.risk}%</b>
              <small>≈ ${(cfg.bal * cfg.risk / 100).toFixed(0)}</small>
            </div>
            <div className="stat-card">
              <span>Kết quả ngày (R)</span>
              <b className={todayR < 0 ? "dn" : "up"}>{todayR.toFixed(1)}R</b>
              <small>Khóa giao dịch ở -{cfg.maxL}R</small>
            </div>
            <div className="stat-card">
              <span>Trạng thái kiểm soát</span>
              <b className={isLocked ? "dn" : "up"}>{isLocked ? "Đã khóa lệnh" : "Sẵn sàng"}</b>
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
            <button className="btn primary" onClick={() => setDlgOpen(true)}>
              + Thêm lệnh mới
            </button>
          </div>

          {!trades.length ? (
            <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--mut)" }}>
              Chưa có lệnh nào được lưu. Bạn có thể thêm lệnh mới hoặc tải dữ liệu mẫu trong mục Cài đặt.
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mã Lệnh</th>
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
                  {trades.slice().reverse().map((t) => {
                    const sess = SES.find((s) => s.id === t.sess) || SES[4];
                    return (
                      <tr key={t.id}>
                        <td>
                          <b className="mono">{t.id}</b>
                          <div className="sub-title">{new Date(t.time).toLocaleString("vi-VN")}</div>
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
          )}
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
    </div>
  );
}
