"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Bot,
  Database,
  LibraryBig,
  LogOut,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { useLibraryStatus } from "@/lib/client/hooks";
import { cn } from "@/lib/utils";

const NAV = [
  {
    href: "/chat",
    label: "对话问答",
    hint: "RAG 精准溯源",
    icon: MessagesSquare,
  },
  {
    href: "/agent",
    label: "AI Agent",
    hint: "学习任务自动化",
    icon: Bot,
  },
  {
    href: "/knowledge",
    label: "知识库",
    hint: "课件解析与向量化",
    icon: LibraryBig,
  },
];

export function AppSidebar({
  user,
}: {
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  const { status, loading } = useLibraryStatus();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // 即使请求失败也回到登录页，Cookie 由服务端会话失效兜底
    }
    window.location.href = "/login";
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-white/[0.06] bg-[#05080f]/85 px-4 pb-5 pt-6 backdrop-blur-2xl lg:flex">
        <div className="px-2">
          <Logo href="/" />
        </div>

        <div className="mt-7 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            学习工作台
          </p>
        </div>

        <nav className="mt-2.5 flex flex-col gap-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200",
                  active
                    ? "bg-white/[0.065] text-white"
                    : "text-slate-400 hover:bg-white/[0.035] hover:text-slate-100"
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full bg-gradient-to-b from-accent to-cyan" />
                ) : null}
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg border transition-colors",
                    active
                      ? "border-accent/25 bg-accent/12 text-accent-soft"
                      : "border-white/[0.06] bg-white/[0.025] text-slate-500 group-hover:text-slate-200"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-[13.5px] font-semibold">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-slate-600">
                    {item.hint}
                  </span>
                </span>
                {active ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mx-2 mt-6 rounded-xl border border-accent/15 bg-gradient-to-br from-accent/[0.12] to-cyan/[0.04] p-3.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-accent-soft">
            <Sparkles className="h-3.5 w-3.5" />
            学习闭环 · RAG × Agent
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            上传课件 → RAG 溯源问答 → Agent 总结、出题、批改代码。
          </p>
          <Link
            href="/knowledge"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 transition hover:text-white"
          >
            管理我的知识库
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent/20 bg-accent/[0.1] text-[12px] font-bold text-accent-soft">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] font-semibold text-slate-200">
                  {user.name}
                </p>
                <p className="truncate text-[9.5px] text-slate-600">
                  {user.email}
                </p>
              </div>
              <button
                onClick={() => void logout()}
                disabled={loggingOut}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-50"
                aria-label="退出登录"
                title="退出登录"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                系统状态
              </span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  status.ok
                    ? "bg-mint shadow-[0_0_7px_rgba(52,211,153,0.8)]"
                    : "bg-amber"
                )}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">大模型</span>
              <Badge
                variant={status.llm === "deepseek" ? "mint" : "amber"}
                className="max-w-[116px]"
              >
                <span className="truncate">
                  {loading
                    ? "检测中"
                    : status.llm === "deepseek"
                      ? status.modelLabel ?? "DeepSeek"
                      : "本地演示"}
                </span>
              </Badge>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">向量引擎</span>
              <span className="font-medium text-slate-300">
                {status.embedding === "remote" ? "远程 Embedding" : "本地哈希向量"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">知识切片</span>
              <span className="font-mono text-slate-300">{status.chunks}</span>
            </div>
          </div>

          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-full justify-between text-slate-500"
            )}
          >
            返回产品首页
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#05080f]/90 px-4 backdrop-blur-2xl lg:hidden">
        <Logo href="/" compact />
        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-lg transition",
                  active
                    ? "bg-accent/15 text-accent-soft"
                    : "text-slate-500 hover:bg-white/[0.05] hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
              </Link>
            );
          })}
          <button
            onClick={() => void logout()}
            disabled={loggingOut}
            aria-label="退出登录"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </nav>
      </header>
    </>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-accent-soft">
            <span className="h-1 w-1 rounded-full bg-accent" />
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500">
            {description}
          </p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusPill({ loading, status }: { loading: boolean; status: ReturnType<typeof useLibraryStatus>["status"] }) {
  return (
    <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[11px] text-slate-500 sm:flex">
      <Database className="h-3 w-3 text-cyan" />
      {loading ? "同步知识库…" : `${status.docs} 份文档 · ${status.chunks} 个切片`}
    </div>
  );
}
