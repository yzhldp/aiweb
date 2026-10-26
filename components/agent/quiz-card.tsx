"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  FileQuestion,
  RotateCcw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { QuizPayload, QuizQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIFFICULTY_VARIANT = {
  基础: "mint",
  进阶: "cyan",
  挑战: "amber",
} as const;

export function QuizCard({ payload }: { payload: QuizPayload }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const choiceQuestions = useMemo(
    () => payload.questions.filter((question) => question.type === "choice"),
    [payload.questions]
  );
  const correctCount = useMemo(
    () =>
      choiceQuestions.filter(
        (question) => answers[question.id] === question.answer
      ).length,
    [answers, choiceQuestions]
  );
  const answeredCount = payload.questions.filter((question) =>
    (answers[question.id] ?? "").trim()
  ).length;

  if (payload.questions.length === 0) {
    return (
      <section className="panel p-6">
        <div className="flex flex-col items-center py-6 text-center">
          <FileQuestion className="h-8 w-8 text-slate-600" />
          <h3 className="mt-3 text-[13px] font-semibold text-slate-300">
            暂无可用题目
          </h3>
          <p className="mt-1.5 max-w-sm text-[11px] leading-relaxed text-slate-600">
            知识库中没有足够的相关片段用于命题。请上传对应课程资料，或换用更具体的知识点后重试。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan/20 bg-cyan/[0.08] text-cyan-soft">
          <ClipboardCheck className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-semibold text-white">
            {payload.title}
          </h2>
          <p className="mt-1 text-[10.5px] text-slate-600">
            {payload.course ? `${payload.course} · ` : ""}
            {payload.questions.length} 道题 · 含标准答案与解析
          </p>
        </div>
        <Badge variant="cyan">等待作答</Badge>
      </header>

      <div className="space-y-3 p-4 sm:p-5">
        {payload.questions.map((question, index) => (
          <QuestionBlock
            key={question.id}
            question={question}
            index={index}
            value={answers[question.id] ?? ""}
            onChange={(value) =>
              setAnswers((previous) => ({ ...previous, [question.id]: value }))
            }
            submitted={submitted}
          />
        ))}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-white/[0.06] bg-[#080d17]/95 px-5 py-3.5 backdrop-blur">
        {!submitted ? (
          <>
            <div className="text-[10.5px] text-slate-600">
              已作答 <span className="font-mono text-slate-300">{answeredCount}</span> /{" "}
              {payload.questions.length} 题
            </div>
            <Button
              variant="accent"
              size="sm"
              className="ml-auto"
              onClick={() => setSubmitted(true)}
            >
              <Check className="h-3.5 w-3.5" />
              提交批改
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-mint/12 text-mint">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-semibold text-slate-200">
                  选择题得分 {correctCount} / {choiceQuestions.length}
                </p>
                <p className="mt-0.5 text-[9.5px] text-slate-600">
                  主观题请对照参考答案与评分要点自查
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重新作答
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

function QuestionBlock({
  question,
  index,
  value,
  onChange,
  submitted,
}: {
  question: QuizQuestion;
  index: number;
  value: string;
  onChange: (value: string) => void;
  submitted: boolean;
}) {
  const isChoice = question.type === "choice";
  const correct = isChoice && value === question.answer;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        submitted && isChoice
          ? correct
            ? "border-mint/25 bg-mint/[0.035]"
            : "border-rose-400/20 bg-rose-400/[0.03]"
          : "border-white/[0.07] bg-white/[0.018]"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] font-semibold text-slate-600">
          Q{index + 1}
        </span>
        <Badge variant="muted">
          {question.type === "choice"
            ? "单项选择"
            : question.type === "short"
              ? "简答题"
              : "代码题"}
        </Badge>
        <Badge variant={DIFFICULTY_VARIANT[question.difficulty] ?? "muted"}>
          {question.difficulty}
        </Badge>
        {question.knowledge ? (
          <span className="ml-auto hidden text-[9.5px] text-slate-600 sm:block">
            {question.knowledge}
          </span>
        ) : null}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-[12px] font-medium leading-[1.8] text-slate-200">
        {question.question}
      </p>

      {isChoice && question.options ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {question.options.map((option) => {
            const selected = value === option.key;
            const isCorrectOption = submitted && option.key === question.answer;
            const isWrongSelected = submitted && selected && !isCorrectOption;
            return (
              <button
                key={option.key}
                type="button"
                disabled={submitted}
                onClick={() => onChange(option.key)}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition",
                  isCorrectOption
                    ? "border-mint/35 bg-mint/[0.08]"
                    : isWrongSelected
                      ? "border-rose-400/30 bg-rose-400/[0.06]"
                      : selected
                        ? "border-accent/35 bg-accent/[0.08]"
                        : "border-white/[0.06] bg-white/[0.014] hover:border-white/15 hover:bg-white/[0.035]"
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[10px] font-semibold",
                    isCorrectOption
                      ? "border-mint/40 bg-mint/15 text-mint"
                      : isWrongSelected
                        ? "border-rose-400/40 bg-rose-400/15 text-rose-300"
                        : selected
                          ? "border-accent/40 bg-accent/15 text-accent-soft"
                          : "border-white/10 bg-white/[0.03] text-slate-500"
                  )}
                >
                  {isCorrectOption ? (
                    <Check className="h-3 w-3" />
                  ) : isWrongSelected ? (
                    <X className="h-3 w-3" />
                  ) : (
                    option.key
                  )}
                </span>
                <span
                  className={cn(
                    "text-[11.5px] leading-relaxed",
                    selected || isCorrectOption
                      ? "text-slate-200"
                      : "text-slate-400"
                  )}
                >
                  {option.text}
                </span>
              </button>
            );
          })}
        </div>
      ) : question.type === "short" ? (
        <textarea
          value={value}
          disabled={submitted}
          onChange={(event) => onChange(event.target.value)}
          placeholder="在这里写下你的答案与关键要点…"
          rows={3}
          className="mt-3 w-full resize-y rounded-lg border border-white/[0.08] bg-[#070c16]/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-accent/35"
        />
      ) : (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[9.5px] text-slate-600">
            <Code2 className="h-3 w-3" />
            {question.language ?? "Python"} · 你的实现
          </div>
          <textarea
            value={value}
            disabled={submitted}
            onChange={(event) => onChange(event.target.value)}
            placeholder="# 在这里编写你的代码"
            rows={7}
            spellCheck={false}
            className="w-full resize-y rounded-lg border border-white/[0.08] bg-[#050912] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-700 focus:border-accent/35"
          />
        </div>
      )}

      {submitted ? (
        <div className="mt-3 space-y-2.5 border-t border-white/[0.06] pt-3">
          <div className="flex items-start gap-2 text-[11px] leading-relaxed">
            <span className="shrink-0 font-semibold text-mint">参考答案</span>
            <span className="whitespace-pre-wrap text-slate-400">
              {question.answer}
            </span>
          </div>
          <div className="rounded-lg border border-accent/12 bg-accent/[0.035] px-3 py-2.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft/80">
              解析
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">
              {question.explanation}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
