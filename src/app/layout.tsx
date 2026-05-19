import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BO3 瑞士輪賽事管理",
  description: "純前端 BO3 瑞士輪賽事管理工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-black text-zinc-100 font-sans">
        {children}
      </body>
    </html>
  );
}
