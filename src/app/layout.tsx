import type { Metadata } from "next";
import Image from "next/image";
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
        <header className="border-b border-zinc-800">
          <div className="max-w-5xl mx-auto px-6 py-4 flex justify-center">
            <Image
              src="/image/labytcg-logo.png"
              alt="LabyTCG 拉比卡牌"
              width={626}
              height={626}
              priority
              className="h-20 w-auto"
            />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
