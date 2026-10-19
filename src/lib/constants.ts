import { MacroSession, ChecklistItem } from "@/types";

export const SES: MacroSession[] = [
  { id: "a1", n: "Asia Macro 1", t: "Mở Asia", s: 1250, e: 1270, m: "Tích lũy Asian Range ban đầu, quét thanh khoản sớm" },
  { id: "a2", n: "Asia Macro 2", t: "Mở Tokyo", s: 1310, e: 1330, m: "Tạo đỉnh/đáy ngày cho AUD, JPY; tạo thanh khoản cho London" },
  { id: "l1", n: "London Macro 1", t: "Mở London", s: 153, e: 180, m: "Mở rộng đầu London, Judas Swing quét range châu Á" },
  { id: "l2", n: "London Macro 2", t: "Giữa London", s: 243, e: 270, m: "Tái phân phối hoặc đẩy thanh khoản theo xu hướng London" },
  { id: "n1", n: "NY AM Macro 1", t: "Mở sàn", s: 530, e: 550, k: 1, m: "Khung giờ vàng: chuẩn bị mở sàn 09:30" },
  { id: "n2", n: "NY AM Macro 2", t: "Equities Run", s: 590, e: 610, k: 1, m: "Quét đỉnh/đáy 09:30, kích hoạt Silver Bullet" },
  { id: "n3", n: "NY AM Macro 3", t: "Đóng phiên sáng", s: 650, e: 670, k: 1, m: "Hoàn thành nhịp di chuyển sáng New York" },
  { id: "ln", n: "NY Lunch", t: "Ăn trưa", s: 710, e: 730, m: "Rebalance FVG hẹp, tránh sideway" },
  { id: "pm", n: "NY PM Macro", t: "PM Run", s: 790, e: 820, m: "Khởi động phiên chiều, đẩy nốt thanh khoản ngày" },
  { id: "lh", n: "NY Last Hour", t: "Cuối ngày", s: 915, e: 945, m: "Chốt vị thế trước 16:00 Equities Close" }
];

export const CHK: ChecklistItem[] = [
  { title: "Đúng khung giờ ICT Macro", desc: "Vào lệnh trong 20 phút của Macro, không vào lúc ngoài phiên", required: true },
  { title: "Bias khung lớn & mục tiêu DOL", desc: "Xác định hướng D1/H4/H1 và đích thanh khoản (Draw on Liquidity)", required: true },
  { title: "Quét thanh khoản (Liquidity Sweep)", desc: "Giá đã quét đỉnh/đáy phiên trước, Asian High/Low hoặc Equal Highs/Lows", required: false },
  { title: "MSS + Displacement", desc: "Nến thân to phá vỡ cấu trúc và để lại khoảng trống giá FVG", required: false },
  { title: "Vào lệnh tại FVG / OB / OTE", desc: "Chờ giá hồi về vùng Premium/Discount, tuyệt đối không đuổi nến", required: false },
  { title: "Quản lý vốn: SL tuyệt đối, R:R ≥ 1:2", desc: "Rủi ro ≤ 1% tài khoản, TP tối thiểu gấp đôi khoảng dừng lỗ", required: true },
  { title: "Tâm lý tỉnh táo", desc: "Tuân thủ xuất sắc, không giao dịch trả thù thị trường sau lệnh thua", required: true }
];

export const PV: Record<string, number> = {
  MNQ: 2,
  NQ: 20,
  MES: 5,
  ES: 50,
  MGC: 10
};

export const SETUPS = [
  "Liquidity Sweep + FVG",
  "MSS + Displacement",
  "Order Block + OTE",
  "Silver Bullet",
  "Judas Swing + Breaker Block"
];
