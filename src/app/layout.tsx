import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "シフト管理システム",
  description: "複数店舗のスタッフシフトと営業カレンダーを一元管理",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
