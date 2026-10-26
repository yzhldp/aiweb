"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  ChevronDown,
  Lightbulb,
  ListTree,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SummaryPayload } from "@/lib/types";

export function SummaryCard({ payload }: { payload: SummaryPayload }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-start gap-3 border-b border-white/[0.06] px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent/[0.09] text-accent-soft">
          <BookMarked className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[14px] font-semibold text-white">
              {payload.title || "考点总结"}
            </h2>
            <span className="rounded-full border border-accent/20 bg-accent/[0.08] px-2 py-0.5 text-[9px] font-medium text-accent-soft">
              STRUCTURED
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
            {payload.overview}
          </p>
        </div>
        <button
          onClick={() => setExpanded((value) => !value)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-white/[0.05] hover:text-white"
          aria-label="展开或收起"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
          />
        </button>
      </header>

      {expanded ? (
        <div className="space-y-5 p-5">
          {payload.sections.length === 0 ? (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-6 text-center text-[11.5px] text-slate-500">
              暂无可整理的考点内容，请上传相关课件后重试。
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {payload.sections.map((section, index) => (
                <div
                  key={`${section.title}-${index}`}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-accent/12 font-mono text-[9px] font-semibold text-accent-soft">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-[11.5px] font-semibold text-slate-200">
                      {section.title}
                    </h3>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {section.points.map((point, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-[11.5px] leading-[1.8] text-slate-400"
                      >
                        <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-gradient-to-r from-accent to-cyan" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {payload.keyTerms.length > 0 ? (
            <div>
              <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <ListTree className="h-3.5 w-3.5 text-cyan" />
                核心术语
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {payload.keyTerms.map((item) => (
                  <div
                    key={item.term}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.016] px-3.5 py-2.5"
                  >
                    <p className="text-[11px] font-semibold text-cyan-soft">
                      {item.term}
                    </p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
                      {item.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {payload.pitfalls.length > 0 ? (
            <div className="rounded-xl border border-amber/15 bg-amber/[0.045] p-4">
              <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-soft/90">
                <AlertTriangle className="h-3.5 w-3.5" />
                易错点提醒
              </div>
              <ul className="space-y-1.5">
                {payload.pitfalls.map((item, index) => (
                  <li
                    key={index}
                    className="flex gap-2 text-[11px] leading-relaxed text-amber-soft/70"
                  >
                    <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
