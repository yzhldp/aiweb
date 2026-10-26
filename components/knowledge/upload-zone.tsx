"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  UploadCloud,
  X,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { notifyLibraryUpdated } from "@/lib/client/api";
import {
  detectFileType,
  SUPPORTED_FORMAT_HINT,
  UPLOAD_ACCEPT,
} from "@/lib/file-types";
import { cn, formatBytes } from "@/lib/utils";

interface UploadResult {
  ok: boolean;
  message?: string;
  error?: string;
  doc?: { name: string; chunkCount: number };
}

const STAGES = [
  "解析文档文本 / OCR 图片",
  "清洗乱码与多余空行",
  "固定长度 + 重叠切片",
  "生成向量表示",
  "写入向量知识库",
];

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

export function UploadZone({
  maxUploadMb,
  onUploaded,
}: {
  maxUploadMb: number;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  useEffect(() => {
    if (phase !== "processing" && phase !== "uploading") return;
    const timer = window.setInterval(() => {
      setStage((current) => Math.min(current + 1, STAGES.length - 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, [phase]);

  const startUpload = useCallback(
    (file: File) => {
      if (!detectFileType(file.name)) {
        setError(`仅支持 ${SUPPORTED_FORMAT_HINT}`);
        setPhase("error");
        return;
      }
      if (file.size === 0) {
        setError("文件内容为空，请重新选择");
        setPhase("error");
        return;
      }
      if (file.size > maxUploadMb * 1024 * 1024) {
        setError(`文件超过 ${maxUploadMb}MB 上限`);
        setPhase("error");
        return;
      }

      setLastFile(file);
      setFileName(file.name);
      setFileSize(file.size);
      setError(null);
      setProgress(2);
      setStage(0);
      setPhase("uploading");

      const form = new FormData();
      form.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/knowledge/upload");
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 72);
        setProgress(percent);
        if (percent >= 72) {
          setPhase("processing");
        }
      };
      xhr.onerror = () => {
        setError("网络连接中断，请检查网络后重试");
        setPhase("error");
      };
      xhr.onload = () => {
        let payload: UploadResult | null = null;
        try {
          payload = JSON.parse(xhr.responseText) as UploadResult;
        } catch {
          payload = null;
        }
        if (xhr.status >= 200 && xhr.status < 300 && payload?.ok) {
          setProgress(100);
          setStage(STAGES.length - 1);
          setPhase("done");
          toast.success(payload.message ?? "资料已加入知识库", {
            description: payload.doc
              ? `${payload.doc.name} · ${payload.doc.chunkCount} 个知识片段`
              : undefined,
          });
          notifyLibraryUpdated();
          onUploaded();
          window.setTimeout(() => {
            setPhase("idle");
            setProgress(0);
            setStage(0);
            setFileName("");
            if (inputRef.current) inputRef.current.value = "";
          }, 2200);
        } else {
          setError(payload?.error ?? `上传失败（${xhr.status}）`);
          setPhase("error");
        }
      };
      xhr.send(form);
    },
    [maxUploadMb, onUploaded]
  );

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    void startUpload(file);
  };

  const reset = () => {
    setPhase("idle");
    setError(null);
    setProgress(0);
    setStage(0);
    setFileName("");
  };

  const busy = phase === "uploading" || phase === "processing";

  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">上传课程资料</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            PDF / Word / Markdown / TXT / HTML / 图片 OCR
            <br />
            单文件最大 {maxUploadMb}MB
          </p>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-slate-500">
          RAG Pipeline
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={(event) => onFiles(event.target.files)}
      />

      {phase === "idle" ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            onFiles(event.dataTransfer.files);
          }}
          className={cn(
            "group mt-4 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-9 transition-all",
            dragging
              ? "border-accent/60 bg-accent/[0.09]"
              : "border-white/12 bg-white/[0.018] hover:border-accent/35 hover:bg-accent/[0.045]"
          )}
        >
          <span className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.09] bg-white/[0.04] transition group-hover:border-accent/30 group-hover:bg-accent/10">
            <UploadCloud
              className={cn(
                "h-6 w-6 transition",
                dragging ? "text-accent-soft" : "text-slate-400 group-hover:text-accent-soft"
              )}
            />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-cyan shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
          </span>
          <span className="mt-4 text-[13px] font-semibold text-slate-200">
            {dragging ? "松开即可上传" : "拖拽文件到这里，或点击选择"}
          </span>
          <span className="mt-1.5 text-[11px] text-slate-600">
            PDF / Word / Markdown / TXT / HTML / 图片
          </span>
          <span className="mt-1 text-[10px] text-slate-700">
            自动完成解析 / OCR · 清洗 · 切片 · 向量化
          </span>
        </button>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
                phase === "done"
                  ? "border-mint/25 bg-mint/10 text-mint"
                  : phase === "error"
                    ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
                    : "border-accent/25 bg-accent/10 text-accent-soft"
              )}
            >
              {phase === "done" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : phase === "error" ? (
                <AlertCircle className="h-5 w-5" />
              ) : busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[12.5px] font-semibold text-slate-100">
                  {fileName}
                </p>
                {phase === "error" ? (
                  <button
                    onClick={reset}
                    className="text-slate-600 transition hover:text-white"
                    aria-label="关闭"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <p className="mt-0.5 text-[10.5px] text-slate-600">
                {formatBytes(fileSize)} ·{" "}
                {phase === "done"
                  ? "已构建完成"
                  : phase === "error"
                    ? "处理失败"
                    : phase === "uploading"
                      ? "正在上传文件"
                      : "正在解析与向量化"}
              </p>
            </div>
          </div>

          {phase !== "error" ? (
            <>
              <Progress
                value={progress}
                indeterminate={phase === "processing" && progress >= 72}
                className="mt-3.5"
              />
              <div className="mt-2.5 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">
                  {phase === "done" ? "全部完成" : STAGES[stage]}
                </span>
                <span className="font-mono text-slate-500">
                  {phase === "done" ? "100%" : `${Math.max(2, progress)}%`}
                </span>
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-lg border border-rose-400/15 bg-rose-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-rose-300">
              {error}
            </div>
          )}

          {phase === "error" ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => lastFile && startUpload(lastFile)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.1]"
              >
                <RefreshCw className="h-3 w-3" />
                重试
              </button>
              <button
                onClick={() => inputRef.current?.click()}
                className="rounded-lg px-2.5 py-1.5 text-[11px] text-slate-500 transition hover:text-white"
              >
                重新选择
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-4">
        {STAGES.map((label, index) => {
          const active = busy && stage === index;
          const done = phase === "done" || (busy && stage > index);
          return (
            <div key={label} className="flex items-center gap-2.5">
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full border text-[9px] font-semibold transition",
                  done
                    ? "border-mint/30 bg-mint/10 text-mint"
                    : active
                      ? "border-accent/40 bg-accent/15 text-accent-soft"
                      : "border-white/[0.08] bg-white/[0.02] text-slate-600"
                )}
              >
                {done ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  "text-[11px] transition",
                  active
                    ? "font-medium text-slate-200"
                    : done
                      ? "text-slate-400"
                      : "text-slate-600"
                )}
              >
                {label}
              </span>
              {active ? (
                <Loader2 className="ml-auto h-3 w-3 animate-spin text-accent-soft" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
