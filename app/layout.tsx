import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CS-LearnMate · 计算机专业智能学习助手",
    template: "%s · CS-LearnMate",
  },
  description:
    "基于 RAG 检索增强与 AI Agent 的计算机专业课智能学习平台。上传课件，构建专属知识库，完成精准问答、考点总结、智能出题与代码批改。",
  keywords: [
    "RAG",
    "AI Agent",
    "计算机专业",
    "智能学习",
    "DeepSeek",
    "知识库",
    "CS-LearnMate",
  ],
  authors: [{ name: "CS-LearnMate" }],
  openGraph: {
    title: "CS-LearnMate · 计算机专业智能学习助手",
    description:
      "上传课程资料或图片，让 AI 以你的课件为依据答疑、总结、出题与批改代码。",
    type: "website",
    locale: "zh_CN",
  },
};

export const viewport: Viewport = {
  themeColor: "#04060c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-ink-950 text-slate-200 antialiased">
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          richColors
          toastOptions={{
            style: {
              background: "rgba(13, 20, 36, 0.96)",
              border: "1px solid rgba(148, 163, 184, 0.16)",
              color: "#e6eaf3",
              backdropFilter: "blur(16px)",
            },
          }}
        />
      </body>
    </html>
  );
}
