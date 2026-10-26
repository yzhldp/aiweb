"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  Database,
  Eye,
  FileCode2,
  FileImage,
  FileText,
  FileType2,
  Globe2,
  Layers3,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { PageHeader, StatusPill } from "@/components/layout/app-sidebar";
import { UploadZone } from "@/components/knowledge/upload-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, notifyLibraryUpdated } from "@/lib/client/api";
import { useLibrary, useLibraryStatus } from "@/lib/client/hooks";
import { fileTypeMeta, inferFileType } from "@/lib/file-types";
import type {
  ChunkPreview,
  KnowledgeDoc,
  KnowledgeFileType,
} from "@/lib/types";
import { cn, formatBytes, formatNumber, formatRelative } from "@/lib/utils";

const DOC_STYLES: Record<
  KnowledgeFileType,
  { icon: LucideIcon; box: string; iconColor: string; badge: string }
> = {
  pdf: {
    icon: FileText,
    box: "border-rose-400/20 bg-gradient-to-br from-rose-500/[0.14] to-orange-400/[0.06]",
    iconColor: "text-rose-300/90",
    badge: "bg-rose-400/90 text-[#1a0b10]",
  },
  docx: {
    icon: FileType2,
    box: "border-sky-400/20 bg-gradient-to-br from-sky-500/[0.14] to-cyan-400/[0.06]",
    iconColor: "text-sky-300/90",
    badge: "bg-sky-400/90 text-[#081421]",
  },
  markdown: {
    icon: FileCode2,
    box: "border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.14] to-teal-400/[0.06]",
    iconColor: "text-emerald-300/90",
    badge: "bg-emerald-400/90 text-[#071510]",
  },
  text: {
    icon: FileCode2,
    box: "border-slate-400/20 bg-gradient-to-br from-slate-500/[0.14] to-slate-400/[0.06]",
    iconColor: "text-slate-300/90",
    badge: "bg-slate-400/90 text-[#0d1117]",
  },
  html: {
    icon: Globe2,
    box: "border-orange-400/20 bg-gradient-to-br from-orange-500/[0.14] to-amber-400/[0.06]",
    iconColor: "text-orange-300/90",
    badge: "bg-orange-400/90 text-[#1a0f06]",
  },
  image: {
    icon: FileImage,
    box: "border-violet-400/20 bg-gradient-to-br from-violet-500/[0.14] to-fuchsia-400/[0.06]",
    iconColor: "text-violet-300/90",
    badge: "bg-violet-400/90 text-[#150a1c]",
  },
};

export default function KnowledgePage() {
  const { data, loading, refresh } = useLibrary();
  const { status } = useLibraryStatus();
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<KnowledgeDoc | null>(null);
  const [chunks, setChunks] = useState<ChunkPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [tab, setTab] = useState<"all" | "mine" | "public">("all");

  const docs = data?.docs ?? [];
  const stats = data?.stats ?? status;
  const publicDocs = docs.filter(
    (doc) => doc.ownerId === "public" || doc.isDemo
  );
  const mineDocs = docs.filter(
    (doc) => doc.ownerId !== "public" && !doc.isDemo
  );
  const visibleDocs =
    tab === "mine" ? mineDocs : tab === "public" ? publicDocs : docs;
  const mineChunks = mineDocs.reduce((sum, doc) => sum + doc.chunkCount, 0);
  const previewMeta = previewTarget
    ? fileTypeMeta(previewTarget.name, previewTarget.fileType)
    : null;

  const seed = async () => {
    setSeeding(true);
    try {
      const result = await apiFetch<{ added: number }>("/api/knowledge/seed", {
        method: "POST",
      });
      toast.success(
        result.added > 0
          ? `已载入 ${result.added} 份公共示例课件`
          : "公共示例课件已存在，无需重复载入"
      );
      notifyLibraryUpdated();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "载入示例失败");
    } finally {
      setSeeding(false);
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      await apiFetch("/api/knowledge", { method: "DELETE" });
      toast.success("已清空我的私有知识库");
      setClearOpen(false);
      notifyLibraryUpdated();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "清空失败");
    } finally {
      setClearing(false);
    }
  };

  const removeDoc = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/knowledge/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`已删除《${deleteTarget.name}》及对应向量`);
      setDeleteTarget(null);
      notifyLibraryUpdated();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const openPreview = useCallback(async (doc: KnowledgeDoc) => {
    setPreviewTarget(doc);
    setPreviewLoading(true);
    setChunks([]);
    try {
      const response = await apiFetch<{ chunks: ChunkPreview[] }>(
        `/api/knowledge/${doc.id}`
      );
      setChunks(response.chunks);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "片段加载失败");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const statCards = [
    {
      label: "知识文档",
      value: formatNumber(stats.docs),
      suffix: "份",
      icon: FileText,
      tone: "text-accent-soft",
    },
    {
      label: "知识切片",
      value: formatNumber(stats.chunks),
      suffix: "片",
      icon: Layers3,
      tone: "text-cyan-soft",
    },
    {
      label: "文本总量",
      value: formatNumber(stats.characters),
      suffix: "字",
      icon: Type,
      tone: "text-mint-soft",
    },
    {
      label: "向量维度",
      value: stats.dim ? String(stats.dim) : "—",
      suffix: stats.embedding === "remote" ? "远程" : "本地",
      icon: Database,
      tone: "text-amber-soft",
    },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="Knowledge Base"
        title="知识库"
        description="公共示例课件人人可读；你上传的 PDF、Word、Markdown、TXT、HTML 与图片，其切片和向量只属于当前账号。图片会自动 OCR，文档统一完成清洗、重叠切片与向量化。"
        actions={
          <>
            <StatusPill loading={loading} status={status} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void refresh()}
              aria-label="刷新"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void seed()} disabled={seeding}>
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              载入公共示例
            </Button>
            {mineDocs.length > 0 ? (
              <Button variant="danger" size="sm" onClick={() => setClearOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                清空我的
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="panel panel-hover p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500">
                  {card.label}
                </span>
                <Icon className={cn("h-4 w-4", card.tone)} />
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-semibold tracking-tight text-white">
                  {card.value}
                </span>
                <span className="text-[10.5px] text-slate-600">{card.suffix}</span>
              </div>
            </div>
          );
        })}
      </div>

      {data?.storage === "memory" ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber/20 bg-amber/[0.06] px-4 py-3 text-[11.5px] leading-relaxed text-amber-soft/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          当前运行在 Serverless / 内存存储模式，实例重启后知识库可能重置。正式部署建议接入持久化向量数据库（如 Pinecone）。
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="panel order-2 overflow-hidden xl:order-1">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">课程资料</h2>
                <p className="mt-1 text-[11px] text-slate-600">
                  {docs.length > 0
                    ? `${mineDocs.length} 份我的资料 · ${publicDocs.length} 份公共课件 · ${stats.chunks} 个可检索片段`
                    : "尚未添加任何资料"}
                </p>
              </div>
              <Badge variant={stats.docs > 0 ? "mint" : "muted"}>
                <span
                  className={cn(
                    "h-1 w-1 rounded-full",
                    stats.docs > 0 ? "bg-mint" : "bg-slate-600"
                  )}
                />
                {stats.docs > 0 ? "可检索" : "等待上传"}
              </Badge>
            </div>
            <div className="mt-3 flex w-fit items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
              {[
                { key: "all" as const, label: "全部", count: docs.length },
                { key: "mine" as const, label: "我的", count: mineDocs.length },
                {
                  key: "public" as const,
                  label: "公共",
                  count: publicDocs.length,
                },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[10.5px] font-medium transition",
                    tab === item.key
                      ? "bg-white/[0.08] text-white"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {item.label}
                  <span className="ml-1 font-mono text-[9px] text-slate-600">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {loading && docs.length === 0 ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-[74px] w-full" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="relative grid h-16 w-16 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                <FileText className="h-7 w-7 text-slate-600" />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#0a101c] bg-accent-soft" />
              </div>
              <h3 className="mt-5 text-sm font-semibold text-slate-200">
                构建你的第一份课程知识库
              </h3>
              <p className="mt-2 max-w-sm text-[11.5px] leading-relaxed text-slate-500">
                上传课程 PDF、Word、Markdown、TXT、HTML 或课件截图，解析 / OCR 完成后即可开始溯源问答。
              </p>
              <div className="mt-5 flex items-center gap-2">
                <Button variant="accent" size="sm" onClick={() => void seed()} disabled={seeding}>
                  {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  载入公共示例
                </Button>
                <span className="text-[10.5px] text-slate-600">
                  含 4 门核心课程
                </span>
              </div>
            </div>
          ) : visibleDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <FileText className="h-6 w-6 text-slate-700" />
              <p className="mt-3 text-[12px] font-medium text-slate-400">
                {tab === "mine" ? "你还没有上传私有资料" : "暂无公共示例课件"}
              </p>
              <p className="mt-1.5 max-w-xs text-[10.5px] leading-relaxed text-slate-600">
                {tab === "mine"
                  ? "在右侧上传文档或图片后，只有当前账号可以检索和删除。"
                  : "点击“载入公共示例”补充 4 门核心课程课件。"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {visibleDocs.map((doc) => {
                const meta = fileTypeMeta(doc.name, doc.fileType);
                const style =
                  DOC_STYLES[inferFileType(doc.name, doc.fileType)];
                const Icon = style.icon;
                return (
                <div
                  key={doc.id}
                  className="group flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-white/[0.02] sm:px-5"
                >
                  <div
                    className={cn(
                      "relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
                      style.box
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px]", style.iconColor)} />
                    <span
                      className={cn(
                        "absolute -bottom-1 left-1/2 -translate-x-1/2 rounded px-1 text-[7px] font-bold leading-[11px] tracking-wider",
                        style.badge
                      )}
                    >
                      {meta.short}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[12.5px] font-semibold text-slate-100">
                        {doc.name}
                      </p>
                      {doc.ownerId === "public" || doc.isDemo ? (
                        <Badge variant="cyan">
                          {doc.isDemo ? "公共示例" : "公共"}
                        </Badge>
                      ) : (
                        <Badge variant="accent">我的</Badge>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] text-mint">
                        <span className="h-1 w-1 rounded-full bg-mint" />
                        就绪
                      </span>
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-slate-600">
                      <span>
                        {meta.paged ? `${doc.pages} 页` : meta.label}
                      </span>
                      <span className="text-slate-700">/</span>
                      <span>{doc.chunkCount} 个切片</span>
                      <span className="text-slate-700">/</span>
                      <span>{formatBytes(doc.size)}</span>
                      <span className="text-slate-700">/</span>
                      <span>{formatRelative(doc.uploadedAt)}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void openPreview(doc)}
                      aria-label="查看切片"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {doc.ownerId !== "public" && !doc.isDemo ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(doc)}
                        aria-label="删除文档"
                        className="hover:bg-rose-400/10 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <span className="px-2 text-[9px] text-slate-700">
                        只读
                      </span>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.012] px-5 py-3">
            <span className="text-[10px] text-slate-600">
              向量引擎：{stats.embedding === "remote" ? "OpenAI 兼容 Embedding" : "本地哈希向量引擎"}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
              检索方式：余弦相似度 + 关键词混合
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </section>

        <div className="order-1 space-y-5 xl:order-2">
          <UploadZone
            maxUploadMb={data?.storage ? status.maxUploadMb : 20}
            onUploaded={() => void refresh()}
          />

          <div className="panel overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <h3 className="text-sm font-semibold text-white">RAG 处理管线</h3>
              <p className="mt-1 text-[11px] text-slate-600">
                每一步都可在问答来源中追溯
              </p>
            </div>
            <div className="space-y-4 px-5 py-4">
              {[
                ["01", "文本抽取", "解析文档文本层，或对图片执行中英文 OCR"],
                ["02", "语义切片", "520 字切片 + 90 字重叠，保留上下文"],
                ["03", "向量编码", "生成稠密向量，写入本地向量索引"],
                ["04", "混合检索", "余弦相似度 + 关键词匹配 Top-K"],
                ["05", "溯源生成", "上下文注入大模型，回答标注原文来源"],
              ].map(([number, title, desc], index) => (
                <div key={number} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-[9px] font-semibold text-accent-soft/80">
                      {number}
                    </span>
                    {index < 4 ? (
                      <span className="mt-1.5 h-full min-h-[22px] w-px bg-gradient-to-b from-white/10 to-transparent" />
                    ) : null}
                  </div>
                  <div className="pb-1">
                    <p className="text-[11.5px] font-medium text-slate-300">
                      {title}
                    </p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-slate-600">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="删除课程文档"
        description="删除后将同时清除该文档的所有向量片段，且无法恢复。"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="danger" size="sm" onClick={() => void removeDoc()} disabled={deleting}>
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              确认删除
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
          <FileText className="h-5 w-5 text-rose-300" />
          <div>
            <p className="text-[13px] font-medium text-slate-200">
              {deleteTarget?.name}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {deleteTarget?.chunkCount} 个知识片段将被移除
            </p>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="清空我的私有知识库？"
        description="只删除你上传的课程资料与向量切片，公共示例课件不受影响。"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setClearOpen(false)}>
              保留文档
            </Button>
            <Button variant="danger" size="sm" onClick={() => void clearAll()} disabled={clearing}>
              {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              清空我的文档
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.05] p-4 text-[12px] leading-relaxed text-slate-400">
          此操作会删除你上传的{" "}
          <strong className="text-white">{mineDocs.length}</strong> 份文档与{" "}
          <strong className="text-white">{mineChunks}</strong> 个向量片段。
          <strong className="text-slate-200">{publicDocs.length}</strong>{" "}
          份公共示例课件将保留。
        </div>
      </Dialog>

      <Dialog
        open={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(null)}
        title={previewTarget?.name ?? "知识片段预览"}
        description={`${previewMeta?.label ?? "文档"}${
          previewMeta?.paged ? ` · ${previewTarget?.pages ?? 0} 页` : ""
        } · ${previewTarget?.chunkCount ?? 0} 个切片 · 展示前 ${
          chunks.length
        } 个片段`}
        className="max-w-3xl"
      >
        {previewLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-slate-500">
            <Spinner /> 正在读取向量片段…
          </div>
        ) : chunks.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-slate-500">
            没有可展示的片段
          </p>
        ) : (
          <div className="space-y-2.5">
            {chunks.map((chunk) => (
              <details
                key={chunk.id}
                open={chunk.index === 0}
                className="group rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 open:border-accent/20 open:bg-accent/[0.035]"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 text-[11.5px] font-medium text-slate-300">
                  <span className="font-mono text-accent-soft">
                    #{chunk.index + 1}
                  </span>
                  <span className="text-slate-600">
                    {previewMeta?.paged
                      ? `第 ${chunk.page} 页`
                      : previewMeta?.label ?? "知识片段"}
                  </span>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-600">{chunk.chars} 字</span>
                  <span className="ml-auto text-[10px] text-slate-600 transition group-open:rotate-180">
                    ▼
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-wrap border-t border-white/[0.06] pt-3 text-[12px] leading-[1.9] text-slate-400">
                  {chunk.content}
                </p>
              </details>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  );
}
