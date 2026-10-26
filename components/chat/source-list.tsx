"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, FileText, Layers } from "lucide-react";
import { fileLocationLabel } from "@/lib/file-types";
import type { Source } from "@/lib/types";
import { cn, percent } from "@/lib/utils";

export function SourceList({
  sources,
  defaultOpen = false,
}: {
  sources: Source[];
  defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);

  if (sources.length === 0) return null;

  return (
    <div className="mt-3.5 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.018]">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-white/[0.025]"
      >
        <span className="grid h-6 w-6 place-items-center rounded-md border border-cyan/20 bg-cyan/[0.07] text-cyan-soft">
          <Layers className="h-3 w-3" />
        </span>
        <span className="text-[11px] font-semibold text-slate-300">
          原文溯源
        </span>
        <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9.5px] text-slate-500">
          {sources.length} 个片段
        </span>
        <span className="ml-auto hidden text-[10px] text-slate-600 sm:block">
          来自你的私有资料与公共课件
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-slate-500 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-white/[0.06] p-2.5">
          {sources.map((source, index) => (
            <details
              key={source.id}
              className="group rounded-lg border border-white/[0.055] bg-[#070c16]/60 transition open:border-accent/20"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-accent/12 font-mono text-[9.5px] font-semibold text-accent-soft">
                  {index + 1}
                </span>
                <FileText className="h-3 w-3 shrink-0 text-slate-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-slate-300">
                    {source.docName}
                  </span>
                  <span className="mt-0.5 block text-[9.5px] text-slate-600">
                    {fileLocationLabel(
                      source.docName,
                      source.fileType,
                      source.page,
                      source.chunkIndex
                    )}
                  </span>
                </span>
                <span className="hidden items-center gap-1.5 sm:flex">
                  <span className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-accent to-cyan"
                      style={{ width: percent(source.score) }}
                    />
                  </span>
                  <span className="font-mono text-[9px] text-slate-500">
                    {percent(source.score)}
                  </span>
                </span>
                <ChevronDown className="h-3 w-3 shrink-0 text-slate-600 transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-white/[0.05] px-3 py-3">
                <div className="mb-2.5 flex items-center gap-1.5 text-[9.5px] font-medium uppercase tracking-wider text-cyan-soft/70">
                  <BookOpen className="h-3 w-3" />
                  原文片段
                </div>
                <p className="whitespace-pre-wrap text-[11.5px] leading-[1.85] text-slate-400">
                  {source.content}
                </p>
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
