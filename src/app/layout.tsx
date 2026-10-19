import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ICT Macro Radar · Nhật ký & Lịch P&L",
  description: "Hệ thống theo dõi phiên ICT Macro, kiểm soát kỷ luật và nhật ký giao dịch đồng bộ Supabase Cloud",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
