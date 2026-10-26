"use client";

import { useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Info,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CodeIssue, CodeReviewPayload, IssueSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITY_META: Record<
  IssueSeverity,
  {
    label: string;
    badge: "danger" | "amber" | "cyan";
    icon: typeof AlertOctagon;
    className: string;
  }
> = {
  error: {
    label: "错误",
    badge: "danger",
    icon: AlertOctagon,
    className: "border-rose-400/18 bg-rose-400/[0.035]",
  },
  warning: {
    label: "警告",
    badge: "amber",
    icon: AlertTriangle,
    className: "border-amber/18 bg-amber/[0.03]",
  },
  info: {
    label: "建议",
    badge: "cyan",
    icon: Info,
    className: "border-cyan/15 bg-cyan/[0.025]",
  },
};

export function ReviewCard({ payload }: { payload: CodeReviewPayload }) {
  const [copied, setCopied] = useState(false);
  const scoreColor =
    payload.score >= 85
      ? "#34d399"
      : payload.score >= 65
        ? "#fbbf24"
        : "#fb7185";
  const circumference = 2 * Math.PI * 26;
  const dashOffset = circumference - (payload.score / 100) * circumference;

  const copy = async () => {
    if (!payload.correctedCode) return;
    try {
      await navigator.clipboard.writeText(payload.correctedCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore clipboard failure
    }
  };

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber/20 bg-amber/[0.08] text-amber-soft">
          <ShieldAlert className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-white">代码批改报告</h2>
          <p className="mt-1 text-[10.5px] text-slate-600">
            {payload.language} · 静态规则 + 语义审查
          </p>
        </div>
        <Badge variant={payload.score >= 85 ? "mint" : payload.score >= 65 ? "amber" : "danger"}>
          {payload.score >= 85 ? "质量良好" : payload.score >= 65 ? "需要改进" : "优先修复"}
        </Badge>
      </header>

      <div className="space-y-5 p-5">
        <div className="flex flex-col gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center">
          <div className="relative h-[68px] w-[68px] shrink-0">
            <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="rgba(148,163,184,0.12)"
                strokeWidth="4"
              />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke={scoreColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-lg font-semibold leading-none text-white">
                {payload.score}
              </span>
              <span className="mt-1 text-[8px] uppercase tracking-wider text-slate-600">
                score
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] leading-[1.85] text-slate-400">
              {payload.summary}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {payload.knowledgePoints.map((point) => (
                <Badge key={point} variant="outline" className="text-[9.5px]">
                  {point}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              问题清单
            </h3>
            <span className="font-mono text-[9.5px] text-slate-600">
              {payload.issues.length} issues
            </span>
          </div>

          {payload.issues.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-mint/18 bg-mint/[0.035] px-4 py-4 text-[11.5px] text-mint-soft">
              <CheckCircle2 className="h-4 w-4" />
              未发现明显语法或边界问题，代码可以进一步通过测试用例验证。
            </div>
          ) : (
            <div className="space-y-2">
              {payload.issues.map((issue, index) => (
                <IssueRow key={`${issue.title}-${index}`} issue={issue} />
              ))}
            </div>
          )}
        </div>

        {payload.lineNotes.length > 0 ? (
          <div>
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              逐行讲解
            </h3>
            <div className="overflow-hidden rounded-xl border border-white/[0.07]">
              {payload.lineNotes.map((note) => (
                <div
                  key={`${note.line}-${note.code}`}
                  className="grid gap-2 border-b border-white/[0.05] bg-[#070c16]/55 px-3.5 py-2.5 last:border-0 sm:grid-cols-[52px_minmax(0,1fr)]"
                >
                  <span className="font-mono text-[10px] text-slate-600">
                    L{note.line}
                  </span>
                  <div>
                    <code className="block overflow-x-auto whitespace-pre font-mono text-[10.5px] text-cyan-soft/85">
                      {note.code || "// 空行"}
                    </code>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
                      {note.note}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {payload.correctedCode ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <Code2 className="h-3.5 w-3.5 text-mint" />
                优化后的代码
              </h3>
              <Button variant="ghost" size="sm" onClick={() => void copy()}>
                {copied ? <Check className="h-3 w-3 text-mint" /> : <Copy className="h-3 w-3" />}
                {copied ? "已复制" : "复制"}
              </Button>
            </div>
            <pre className="code-scroll overflow-x-auto rounded-xl border border-white/[0.08] bg-[#050912] p-4 text-[11px] leading-relaxed text-slate-300">
              <code>{payload.correctedCode}</code>
            </pre>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.018] px-3.5 py-3 text-[10.5px] leading-relaxed text-slate-500">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-soft" />
            当前为本地规则审查，未自动重写代码。配置 DeepSeek API 后可获得完整的修复代码与更深入的语义分析。
          </div>
        )}
      </div>
    </section>
  );
}

function IssueRow({ issue }: { issue: CodeIssue }) {
  const meta = SEVERITY_META[issue.severity] ?? SEVERITY_META.info;
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3",
        meta.className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="text-[11.5px] font-semibold text-slate-200">
          {issue.title}
        </span>
        <Badge variant={meta.badge}>{meta.label}</Badge>
        {issue.line ? (
          <span className="ml-auto font-mono text-[9.5px] text-slate-600">
            Line {issue.line}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">
        {issue.detail}
      </p>
      <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-400">
        <span className="font-medium text-slate-300">建议：</span>
        {issue.suggestion}
      </p>
    </div>
  );
}
