# ICT Macro Radar

> Hệ thống theo dõi phiên ICT Macro, kiểm soát kỷ luật giao dịch và nhật ký lệnh thời gian thực, tích hợp Supabase Cloud và Lịch P&L tháng tương tác.

---

## Tính năng chính

- **Radar giờ Macro (10 Phiên)**: Theo dõi khung giờ vàng ICT (NY AM, London, Asia), tự động nhận diện mùa hè EDT / mùa đông EST và tính độ lệch giờ Việt Nam theo thời gian thực.
- **Checklist ICT & Quản lý kỷ luật**: 7 tiêu chuẩn ICT bắt buộc trước khi vào lệnh, thanh tiến độ %, tự động khóa giao dịch khi chạm ngưỡng rủi ro hoặc số lệnh tối đa trong ngày.
- **Nhật ký giao dịch (Trade Log)**: Lưu trữ đầy đủ chi tiết lệnh (cặp, vị thế Mua/Bán, điểm vào, SL, TP, giá thoát, kết quả P&L $ và R-multiple, ghi chú tâm lý).
- **Lịch P&L theo tháng tương tác (Tab Hiệu suất)**:
  - Khung lịch 7 cột T2 – CN trực quan.
  - Phân biệt ngày hiện tại (badge nhãn `Nay`) và ngày đang được chọn (viền khung nổi bật).
  - Drill-down xem danh sách toàn bộ các lệnh khi click vào từng ngày.
  - Biểu đồ đường vốn tích lũy theo R (Cumulative Equity Curve).
- **Đồng bộ Cơ sở dữ liệu Supabase Cloud**: Lưu trữ dữ liệu an toàn trên đám mây, tự động fallback LocalStorage nếu offline hoặc chưa cấu hình.
- **Chế độ Giao diện**: Hỗ trợ Sáng / Tối (Light & Dark Mode).

---

## Công nghệ sử dụng

- **Framework**: [Next.js](https://nextjs.org) (App Router, Turbopack, React 19)
- **Ngôn ngữ**: TypeScript
- **Cơ sở dữ liệu**: [Supabase](https://supabase.com) (`@supabase/supabase-js`)
- **Giao diện**: Vanilla CSS Design System, Responsive, HSL Theme Colors

---

## Hướng dẫn cài đặt & Chạy dự án

### 1. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 2. Cấu hình Supabase (Tùy chọn)
1. Tạo một dự án mới trên [Supabase](https://supabase.com).
2. Vào **SQL Editor**, dán toàn bộ nội dung file `supabase_schema.sql` và bấm **Run**.
3. Sao chép file `.env.example` thành `.env.local` và điền thông tin:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```
*(Bạn cũng có thể cấu hình trực tiếp Project URL và Anon Key trong tab **Cài đặt & Supabase** trên giao diện web).*

### 3. Chạy server phát triển
```bash
npm run dev
```
Truy cập ứng dụng tại: [http://localhost:3000](http://localhost:3000)

### 4. Đóng gói cho môi trường Production
```bash
npm run build
npm run start
```
