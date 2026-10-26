"use client";

import {
  BookMarked,
  Bot,
  Check,
  Code2,
  ListChecks,
  Loader2,
  Network,
  Sparkles,
  X,
} from "lucide-react";
import type { AgentStepState, AgentTool } from "@/lib/types";
import { cn } from "@/lib/utils";

const TOOL_ICON: Record<AgentTool, typeof Bot> = {
  summary: BookMarked,
  quiz: ListChecks,
  review: Code2,
  answer: Sparkles,
};

const TOOL_TONE: Record<AgentTool, string> = {
  summary: "border-accent/22 bg-accent/[0.09] text-accent-soft",
  quiz: "border-cyan/22 bg-cyan/[0.08] text-cyan-soft",
  review: "border-amber/22 bg-amber/[0.07] text-amber-soft",
  answer: "border-mint/20 bg-mint/[0.07] text-mint-soft",
};

export function AgentTimeline({
  steps,
  running,
  mode,
}: {
  steps: AgentStepState[];
  running: boolean;
  mode: "deepseek" | "local";
}) {
  return (
    <aside className="panel overflow-hidden xl:sticky xl:top-6">
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-4">
        <span className="relative grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
          <Bot className="h-4 w-4 text-accent-soft" />
          {running ? (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-mint shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          ) : null}
        </span>
        <div className="flex-1">
          <h2 className="text-[12.5px] font-semibold text-white">
            Agent 思考过程
          </h2>
          <p className="mt-0.5 text-[9.5px] text-slate-600">
            意图识别 → 任务拆解 → 工具调用
          </p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold",
            running
              ? "border-mint/20 bg-mint/[0.08] text-mint"
              : "border-white/[0.07] bg-white/[0.025] text-slate-500"
          )}
        >
          <span
            className={cn(
              "h-1 w-1 rounded-full",
              running ? "animate-pulse bg-mint" : "bg-slate-600"
            )}
          />
          {running ? "执行中" : "待命"}
        </span>
      </div>

      {steps.length === 0 ? (
        <div className="px-5 py-6">
          <div className="space-y-3">
            {[
              {
                icon: BookMarked,
                title: "考点总结",
                desc: "从课件中提炼核心概念与易错点",
                tone: TOOL_TONE.summary,
              },
              {
                icon: ListChecks,
                title: "智能出题",
                desc: "生成选择题、简答题与代码题",
                tone: TOOL_TONE.quiz,
              },
              {
                icon: Code2,
                title: "代码批改",
                desc: "定位语法、边界与逻辑问题",
                tone: TOOL_TONE.review,
              },
            ].map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.title}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.055] bg-white/[0.014] p-3"
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg border",
                      tool.tone
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[10.5px] font-semibold text-slate-300">
                      {tool.title}
                    </p>
                    <p className="mt-0.5 text-[9.5px] leading-relaxed text-slate-600">
                      {tool.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/[0.055] bg-white/[0.012] px-3 py-2.5 text-[9.5px] leading-relaxed text-slate-600">
            <Network className="mt-0.5 h-3 w-3 shrink-0 text-cyan" />
            复合指令会自动拆成多个步骤，并按依赖顺序执行。所有工具均检索你的私有知识库。
          </div>
        </div>
      ) : (
        <div className="px-5 py-5">
          <div className="relative space-y-1">
            {steps.map((step, index) => {
              const Icon = TOOL_ICON[step.tool] ?? Bot;
              const isLast = index === steps.length - 1;
              return (
                <div key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {!isLast ? (
                    <span
                      className={cn(
                        "absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-px",
                        step.status === "done"
                          ? "bg-gradient-to-b from-mint/35 to-white/[0.06]"
                          : "bg-white/[0.06]"
                      )}
                    />
                  ) : null}

                  <span
                    className={cn(
                      "relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-all",
                      step.status === "running"
                        ? "border-accent/35 bg-accent/[0.12] text-accent-soft shadow-[0_0_20px_-5px_rgba(124,108,255,0.55)]"
                        : step.status === "done"
                          ? "border-mint/25 bg-mint/[0.08] text-mint"
                          : step.status === "error"
                            ? "border-rose-400/25 bg-rose-400/[0.07] text-rose-300"
                            : "border-white/[0.07] bg-white/[0.025] text-slate-600"
                    )}
                  >
                    {step.status === "running" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : step.status === "done" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : step.status === "error" ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[11.5px] font-semibold",
                          step.status === "pending"
                            ? "text-slate-500"
                            : "text-slate-200"
                        )}
                      >
                        {step.title}
                      </span>
                      {step.status === "running" ? (
                        <span className="text-[9px] text-accent-soft">
                          调用中…
                        </span>
                      ) : step.durationMs ? (
                        <span className="font-mono text-[8.5px] text-slate-600">
                          {(step.durationMs / 1000).toFixed(1)}s
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[9.5px] leading-relaxed text-slate-600">
                      {step.description}
                    </p>
                    {step.status === "done" && step.detail ? (
                      <p className="mt-1.5 rounded-md border border-mint/10 bg-mint/[0.035] px-2 py-1.5 text-[9.5px] leading-relaxed text-mint-soft/80">
                        {step.detail}
                      </p>
                    ) : null}
                    {step.status === "error" && step.detail ? (
                      <p className="mt-1.5 rounded-md border border-rose-400/12 bg-rose-400/[0.035] px-2 py-1.5 text-[9.5px] leading-relaxed text-rose-300/90">
                        {step.detail}
                      </p>
                    ) : null}
                    {step.status === "running" ? (
                      <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/[0.05]">
                        <div className="h-full w-1/2 animate-shimmer rounded-full bg-[linear-gradient(90deg,transparent,#7c6cff,#22d3ee,transparent)] bg-[length:200%_100%]" />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-3.5">
            <span className="text-[9px] text-slate-600">
              规划策略：意图规则 + 工具编排
            </span>
            <span className="flex items-center gap-1 text-[9px] text-slate-600">
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  mode === "deepseek" ? "bg-mint" : "bg-amber"
                )}
              />
              {mode === "deepseek" ? "DeepSeek 推理" : "本地演示引擎"}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
