"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  BookMarked,
  Bot,
  Braces,
  CheckCircle2,
  ChevronUp,
  Code2,
  Database,
  FileCode2,
  ListChecks,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  Square,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { AgentTimeline } from "@/components/agent/timeline";
import { QuizCard } from "@/components/agent/quiz-card";
import { ReviewCard } from "@/components/agent/review-card";
import { SummaryCard } from "@/components/agent/summary-card";
import { PageHeader } from "@/components/layout/app-sidebar";
import { Markdown } from "@/components/markdown";
import { ModelSettings } from "@/components/model-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLibraryStatus } from "@/lib/client/hooks";
import { consumeSse } from "@/lib/client/sse";
import { AGENT_PRESETS, CODE_TEMPLATES } from "@/lib/constants";
import type {
  AgentResult,
  AgentSseEvent,
  AgentStepPlan,
  AgentStepState,
  AgentTool,
  AnswerPayload,
  CodeReviewPayload,
  QuizPayload,
  SummaryPayload,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface ResultItem {
  id: string;
  tool: AgentTool;
  payload: AgentResult;
}

const PRESET_ICONS = {
  book: BookOpen,
  quiz: ListChecks,
  code: Code2,
} as const;

export default function AgentPage() {
  const { status } = useLibraryStatus();
  const [instruction, setInstruction] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [language, setLanguage] = useState<"C" | "Python">("C");
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<AgentStepState[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [finalText, setFinalText] = useState("");
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [mode, setMode] = useState<"deepseek" | "local">(
    status.llm === "deepseek" ? "deepseek" : "local"
  );
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const previousResultCount = useRef(0);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (results.length > previousResultCount.current && hasRun) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    previousResultCount.current = results.length;
  }, [results.length, hasRun]);

  const applyPreset = (preset: (typeof AGENT_PRESETS)[number]) => {
    setInstruction(preset.instruction);
    setError(null);
    if (preset.title === "代码批改") {
      setShowCode(true);
      setLanguage("C");
      if (!code.trim()) setCode(CODE_TEMPLATES.C);
    }
  };

  const run = async () => {
    if (running) return;
    const task = instruction.trim();
    const submittedCode = showCode ? code.trim() : "";
    if (!task && !submittedCode) {
      toast.error("请输入学习任务，或附带需要批改的代码");
      return;
    }

    setRunning(true);
    setHasRun(true);
    setSteps([]);
    setResults([]);
    setFinalText("");
    setError(null);
    previousResultCount.current = 0;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: task,
          code: submittedCode,
          language,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `请求失败（${response.status}）`);
      }

      await consumeSse<AgentSseEvent>(
        response,
        (event) => {
          if (event.type === "plan") {
            setSteps(
              event.steps.map((step: AgentStepPlan) => ({
                ...step,
                status: "pending" as const,
              }))
            );
          } else if (event.type === "step") {
            setSteps((previous) =>
              previous.map((step) =>
                step.id === event.id
                  ? {
                      ...step,
                      status: event.status,
                      detail: event.detail ?? step.detail,
                      durationMs: event.durationMs ?? step.durationMs,
                    }
                  : step
              )
            );
          } else if (event.type === "result") {
            setResults((previous) => [
              ...previous.filter((item) => item.id !== event.id),
              { id: event.id, tool: event.tool, payload: event.payload },
            ]);
          } else if (event.type === "final") {
            setFinalText(event.text);
            setMode(event.mode);
            setModelLabel(event.modelLabel ?? null);
          } else if (event.type === "error") {
            setError(event.message);
            toast.error(event.message);
          } else if (event.type === "done") {
            setRunning(false);
          }
        },
        controller.signal
      );
    } catch (err) {
      if (controller.signal.aborted) {
        setSteps((previous) =>
          previous.map((step) =>
            step.status === "running"
              ? { ...step, status: "error", detail: "任务已手动停止" }
              : step
          )
        );
        setFinalText("任务已停止。你可以修改指令后重新运行 Agent。");
      } else {
        const message = err instanceof Error ? err.message : "Agent 执行失败";
        setError(message);
        toast.error(message);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const toggleCode = () => {
    setShowCode((value) => {
      const next = !value;
      if (next && !code.trim()) setCode(CODE_TEMPLATES[language]);
      return next;
    });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        eyebrow="AI Agent · Learning Loop"
        title="智能学习体"
        description="用一句复合指令描述学习目标，Agent 会自动拆解任务、调用工具并依次完成考点总结、智能出题与代码批改。每一步思考过程都实时可见。"
        actions={
          <>
            <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[10.5px] text-slate-500 sm:flex">
              <Database className="h-3 w-3 text-cyan" />
              {status.chunks} 个检索片段
            </div>
            <ModelSettings />
            <Badge
              variant={status.llm === "deepseek" ? "mint" : "amber"}
              className="max-w-[170px]"
            >
              <span className="h-1 w-1 rounded-full bg-current" />
              <span className="truncate">
                {status.llm === "deepseek"
                  ? `${status.modelLabel ?? "DeepSeek"} Agent`
                  : "本地演示 Agent"}
              </span>
            </Badge>
          </>
        }
      />

      <section className="panel overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-3.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-accent/20 bg-accent/[0.09] text-accent-soft">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="flex-1">
            <h2 className="text-[12.5px] font-semibold text-white">
              下达学习任务
            </h2>
          </div>
          <span className="hidden items-center gap-1 text-[9.5px] text-slate-600 sm:flex">
            <ShieldCheck className="h-3 w-3" />
            基于你的个人 + 公共课件执行
          </span>
        </div>

        <div className="space-y-3.5 p-4 sm:p-5">
          <div className="relative">
            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              disabled={running}
              rows={3}
              maxLength={2000}
              placeholder={'例如：帮我复习进程调度的核心知识点，并出题练习。\n复合指令会被自动拆解为：考点总结 → 智能出题。'}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#070c16]/60 px-4 py-3.5 text-[13px] leading-relaxed text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-accent/35 focus:bg-[#070c16]/85 focus:ring-2 focus:ring-accent/10 disabled:opacity-60"
            />
            <span className="pointer-events-none absolute bottom-3 right-3 font-mono text-[9px] text-slate-700">
              {instruction.length}/2000
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {AGENT_PRESETS.map((preset) => {
              const Icon =
                PRESET_ICONS[preset.icon as keyof typeof PRESET_ICONS] ?? Sparkles;
              return (
                <button
                  key={preset.title}
                  onClick={() => applyPreset(preset)}
                  disabled={running}
                  className="group flex items-center gap-2 rounded-lg border border-white/[0.065] bg-white/[0.016] px-2.5 py-1.5 text-left transition hover:border-accent/25 hover:bg-accent/[0.045] disabled:opacity-50"
                >
                  <Icon className="h-3 w-3 text-slate-500 transition group-hover:text-accent-soft" />
                  <span className="text-[10.5px] font-medium text-slate-400 transition group-hover:text-slate-200">
                    {preset.title}
                  </span>
                </button>
              );
            })}
            <span className="hidden items-center gap-1 self-center text-[9.5px] text-slate-700 md:flex">
              <Wand2 className="h-3 w-3" />
              点击快速填充示例指令
            </span>
          </div>

          {showCode ? (
            <div className="animate-fade-in overflow-hidden rounded-xl border border-white/[0.08] bg-[#050912]">
              <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <FileCode2 className="h-3.5 w-3.5 text-amber-soft" />
                  代码工作区
                </div>
                <div className="ml-1 flex rounded-md border border-white/[0.07] bg-white/[0.02] p-0.5">
                  {(["C", "Python"] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => setLanguage(item)}
                      className={cn(
                        "rounded px-2 py-1 text-[9.5px] font-medium transition",
                        language === item
                          ? "bg-white/[0.08] text-white"
                          : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setCode(CODE_TEMPLATES[language]);
                    toast.success(`已载入 ${language} 示例代码`);
                  }}
                  className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[9.5px] text-slate-600 transition hover:bg-white/[0.04] hover:text-slate-300"
                >
                  <Braces className="h-3 w-3" />
                  插入示例
                </button>
                <button
                  onClick={() => setShowCode(false)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[9.5px] text-slate-600 transition hover:bg-white/[0.04] hover:text-slate-300"
                >
                  <ChevronUp className="h-3 w-3" />
                  收起
                </button>
              </div>
              <textarea
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={running}
                spellCheck={false}
                rows={10}
                placeholder={`// 粘贴需要批改的 ${language} 代码`}
                className="w-full resize-y bg-transparent p-4 font-mono text-[11.5px] leading-[1.75] text-slate-300 outline-none placeholder:text-slate-700"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3.5">
            <button
              onClick={toggleCode}
              disabled={running}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-medium transition disabled:opacity-50",
                showCode
                  ? "border-amber/25 bg-amber/[0.08] text-amber-soft"
                  : "border-white/[0.07] bg-white/[0.02] text-slate-500 hover:border-white/15 hover:text-slate-300"
              )}
            >
              <Code2 className="h-3.5 w-3.5" />
              {showCode ? "已附带代码" : "附带代码审查"}
            </button>

            <span className="hidden items-center gap-1.5 text-[9.5px] text-slate-700 sm:flex">
              <Bot className="h-3 w-3" />
              自动匹配考点 / 出题 / 批改工具
            </span>

            <div className="ml-auto flex items-center gap-2">
              {running ? (
                <Button variant="danger" size="sm" onClick={stop}>
                  <Square className="h-3 w-3 fill-current" />
                  停止 Agent
                </Button>
              ) : (
                <Button variant="accent" size="sm" onClick={() => void run()}>
                  <Play className="h-3.5 w-3.5" />
                  运行 Agent
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
        <div className="order-2 min-w-0 space-y-4 xl:order-1">
          {error ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-400/20 bg-rose-400/[0.055] px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <div>
                <p className="text-[11.5px] font-semibold text-rose-300">
                  Agent 执行遇到问题
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-rose-300/70">
                  {error}
                </p>
              </div>
            </div>
          ) : null}

          {finalText ? (
            <div className="relative overflow-hidden rounded-2xl border border-mint/18 bg-gradient-to-br from-mint/[0.065] to-cyan/[0.02] px-4 py-3.5 sm:px-5">
              <div className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-mint/25 bg-mint/10 text-mint">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mint-soft/80">
                      Agent 总结
                    </span>
                    <Badge
                      variant={mode === "deepseek" ? "mint" : "amber"}
                      className="max-w-[160px]"
                    >
                      <span className="truncate">
                        {mode === "deepseek"
                          ? modelLabel ?? "外部模型"
                          : "本地演示"}
                      </span>
                    </Badge>
                  </div>
                  <div className="text-[11.5px] leading-relaxed text-slate-300">
                    <Markdown content={finalText} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div ref={resultsRef} className="scroll-mt-6 space-y-4">
            {results.map((result) => (
              <ResultView key={result.id} item={result} />
            ))}
          </div>

          {running && results.length === 0 ? (
            <div className="panel flex items-center gap-3 p-5">
              <Loader2 className="h-5 w-5 animate-spin text-accent-soft" />
              <div>
                <p className="text-[12px] font-medium text-slate-300">
                  Agent 正在拆解任务并检索知识库…
                </p>
                <p className="mt-1 text-[10px] text-slate-600">
                  工具调用过程会在右侧实时展示
                </p>
              </div>
            </div>
          ) : null}

          {!hasRun ? (
            <div className="panel overflow-hidden">
              <div className="relative border-b border-white/[0.06] px-6 py-8 text-center">
                <div className="pointer-events-none absolute inset-0 bg-dots opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
                <div className="relative">
                  <span className="inline-grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-accent/18 to-cyan/5 shadow-glow">
                    <Bot className="h-6 w-6 text-accent-soft" />
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold text-white">
                    Agent 已就绪
                  </h3>
                  <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-relaxed text-slate-500">
                    内置考点总结、智能出题、代码批改三大工具。输入复合学习指令，观察 Agent
                    如何自主规划并完成完整学习闭环。
                  </p>
                </div>
              </div>
              <div className="grid gap-2.5 p-4 sm:grid-cols-3">
                {[
                  {
                    icon: BookMarked,
                    title: "考点总结",
                    desc: "提炼核心概念、机制与易错点",
                    tone: "text-accent-soft border-accent/20 bg-accent/[0.07]",
                  },
                  {
                    icon: ListChecks,
                    title: "智能出题",
                    desc: "5 道分层练习 + 标准解析",
                    tone: "text-cyan-soft border-cyan/20 bg-cyan/[0.06]",
                  },
                  {
                    icon: Code2,
                    title: "代码批改",
                    desc: "语法、边界、逻辑逐行讲解",
                    tone: "text-amber-soft border-amber/20 bg-amber/[0.06]",
                  },
                ].map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <div
                      key={tool.title}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.014] p-3.5"
                    >
                      <span
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-lg border",
                          tool.tone
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <p className="mt-2.5 text-[11px] font-semibold text-slate-300">
                        {tool.title}
                      </p>
                      <p className="mt-1 text-[9.5px] leading-relaxed text-slate-600">
                        {tool.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-white/[0.06] bg-white/[0.012] px-5 py-3 text-center text-[9.5px] text-slate-600">
                试试：“帮我复习 TCP 三次握手，并出 5 道选择题”
              </div>
            </div>
          ) : null}
        </div>

        <div className="order-1 xl:order-2">
          <AgentTimeline steps={steps} running={running} mode={mode} />
        </div>
      </div>
    </div>
  );
}

function ResultView({ item }: { item: ResultItem }) {
  if (item.tool === "summary") {
    return <SummaryCard payload={item.payload as SummaryPayload} />;
  }
  if (item.tool === "quiz") {
    return <QuizCard payload={item.payload as QuizPayload} />;
  }
  if (item.tool === "review") {
    return <ReviewCard payload={item.payload as CodeReviewPayload} />;
  }
  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-mint" />
        <h2 className="text-[13px] font-semibold text-white">知识库回答</h2>
      </div>
      <Markdown content={(item.payload as AnswerPayload).content} />
    </section>
  );
}
