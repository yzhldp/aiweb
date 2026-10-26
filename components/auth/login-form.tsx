"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirm("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);

    if (mode === "register") {
      if (name.trim().length === 0) {
        setError("请输入昵称");
        return;
      }
      if (password.length < 6) {
        setError("密码至少需要 6 位");
        return;
      }
      if (password !== confirm) {
        setError("两次输入的密码不一致");
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "login"
              ? { email, password }
              : { name, email, password }
          ),
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `请求失败（${response.status}）`);
      }
      window.location.href = "/chat";
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-aurora">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />
      <div className="pointer-events-none absolute -left-40 top-1/4 h-[420px] w-[420px] rounded-full bg-accent/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[380px] w-[380px] rounded-full bg-cyan/10 blur-[120px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[1.05fr_460px] lg:items-center lg:gap-16">
        <div className="hidden lg:block">
          <Logo href="/" />
          <h1 className="mt-10 text-[40px] font-bold leading-[1.15] tracking-tight text-white">
            让每个账号，
            <br />
            拥有<span className="text-gradient">独立的学习空间</span>。
          </h1>
          <p className="mt-5 max-w-md text-[13px] leading-relaxed text-slate-500">
            公共示例课件人人可读，你上传的课程资料只有自己可见。外部大模型
            API Key 加密保存在服务端，仅由你本人发起的学习任务调用。
          </p>

          <div className="mt-9 space-y-3.5">
            {[
              {
                icon: Database,
                title: "私有知识库隔离",
                desc: "上传的文档、切片与向量只属于当前账号",
              },
              {
                icon: KeyRound,
                title: "个人模型独立调用",
                desc: "AES-256-GCM 加密存储，其他账号无法读取或使用",
              },
              {
                icon: Bot,
                title: "RAG × Agent 完整闭环",
                desc: "溯源问答、考点总结、智能出题与代码批改",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-accent-soft">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold text-slate-200">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-600">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full">
          <div className="mb-7 flex items-center justify-between lg:hidden">
            <Logo href="/" compact />
            <Link
              href="/"
              className="text-[11px] text-slate-500 transition hover:text-slate-200"
            >
              返回首页
            </Link>
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-white/[0.06] px-6 pb-5 pt-6">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-soft">
                <Sparkles className="h-3 w-3" />
                CS-LearnMate
              </div>
              <h2 className="mt-2.5 text-[22px] font-bold tracking-tight text-white">
                {mode === "login" ? "登录学习工作台" : "创建你的学习账号"}
              </h2>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500">
                {mode === "login"
                  ? "继续你的私有知识库、对话记录与个人模型配置。"
                  : "注册后自动获得独立知识库和个人模型配置空间。"}
              </p>
            </div>

            <div className="px-6 pt-4">
              <div className="flex rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
                {(["login", "register"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => switchMode(item)}
                    className={cn(
                      "flex-1 rounded-lg py-2 text-[11.5px] font-semibold transition",
                      mode === item
                        ? "bg-white/[0.08] text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {item === "login" ? "登录" : "注册"}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={submit} className="space-y-3.5 px-6 py-5">
              {mode === "register" ? (
                <Field icon={User} label="昵称">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="例如：小林"
                    maxLength={24}
                    autoComplete="nickname"
                    className="w-full bg-transparent text-[13px] text-slate-100 outline-none placeholder:text-slate-600"
                  />
                </Field>
              ) : null}

              <Field icon={Mail} label="邮箱">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full bg-transparent text-[13px] text-slate-100 outline-none placeholder:text-slate-600"
                />
              </Field>

              <Field icon={Lock} label="密码">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === "register" ? "至少 6 位" : "输入密码"}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  required
                  className="w-full bg-transparent pr-8 text-[13px] text-slate-100 outline-none placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 transition hover:text-slate-300"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </Field>

              {mode === "register" ? (
                <Field icon={Lock} label="确认密码">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                    required
                    className="w-full bg-transparent text-[13px] text-slate-100 outline-none placeholder:text-slate-600"
                  />
                </Field>
              ) : null}

              {error ? (
                <p className="rounded-lg border border-rose-400/15 bg-rose-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-rose-300">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="accent"
                className="mt-1 w-full"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {mode === "login" ? "登录并进入工作台" : "注册并进入工作台"}
              </Button>

              <p className="flex items-start gap-1.5 pt-1 text-[9.5px] leading-relaxed text-slate-600">
                <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
                密码使用 scrypt 加盐哈希保存；登录态通过 HttpOnly
                会话 Cookie 维持。系统不会明文保存你的密码。
              </p>
            </form>
          </div>

          <p className="mt-4 text-center text-[10px] text-slate-600 lg:hidden">
            公共课件人人可读 · 私有资料按账号隔离 · 模型密钥仅本人可用
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-medium text-slate-500">
        {label}
      </span>
      <span className="relative flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-3 transition focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:ring-2 focus-within:ring-accent/10">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
        {children}
      </span>
    </label>
  );
}
