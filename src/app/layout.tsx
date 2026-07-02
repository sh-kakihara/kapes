import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "人事評価システム",
  description: "柿原工業 人事評価システム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
