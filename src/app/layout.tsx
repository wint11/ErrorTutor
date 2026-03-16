import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AntdRegistry } from '@ant-design/nextjs-registry';
import Navbar from "@/components/Navbar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "数智学堂 - 个性化错题驱动学习平台",
  description: "基于 AI 的智能数学辅导系统，帮助学生攻克错题，提升数学能力",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen bg-gray-50 flex flex-col`}
      >
        <AntdRegistry>
          <Navbar />
          <main className="flex-grow w-full flex flex-col items-center">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col flex-grow">
              {children}
            </div>
          </main>
        </AntdRegistry>
      </body>
    </html>
  );
}
