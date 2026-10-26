"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/client/api";
import type { UserModelInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ModelResponse {
  personal: UserModelInfo | null;
  effective: {
    source: "personal" | "env" | "none";
    label: string;
    modelName: string;
    baseURL?: string | null;
  };
}

const PRESETS = [
  {
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  {
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  {
    name: "Kimi",
    baseURL: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
  },
  {
    name: "硅基流动",
    baseURL: "https://api.siliconflow.cn/v1",
    model: "Qwen/Qwen2.5-7B-Instruct",
  },
  {
    name: "Ollama 本地",
    baseURL: "http://localhost:11434/v1",
    model: "qwen2.5:7b",
  },
];

const inputClass =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-[12px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-accent/40 focus:bg-white/[0.04] focus:ring-2 focus:ring-accent/10";

export function ModelSettings({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [data, setData] = useState<ModelResponse | null>(null);
  const [form, setForm] = useState({
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    label: "",
    apiKey: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<ModelResponse>("/api/models", {
        cache: "no-store",
      });
      setData(response);
      setForm({
        baseURL:
          response.personal?.baseURL ??
          response.effective.baseURL ??
          "https://api.deepseek.com/v1",
        model:
          response.personal?.model ??
          (response.effective.modelName !== "local"
            ? response.effective.modelName
            : "deepseek-chat"),
        label: response.personal?.label ?? "",
        apiKey: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "模型配置加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    setConfirmRemove(false);
    setTestResult(null);
    void load();
  }, [open, load]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setTestResult(null);
    try {
      const response = await apiFetch<ModelResponse>("/api/models", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setData(response);
      setForm((previous) => ({ ...previous, apiKey: "" }));
      toast.success("个人模型配置已加密保存");
      window.dispatchEvent(new CustomEvent("learnmate:library-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (testing) return;
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const response = await apiFetch<{ models?: string[] }>("/api/models", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setTestResult(
        response.models && response.models.length > 0
          ? `连接成功，可用模型：${response.models.slice(0, 4).join(" / ")}`
          : "连接成功，Base URL 与 API Key 有效"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "连接测试失败");
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch<{ ok: boolean }>("/api/models", { method: "DELETE" });
      toast.success("已移除个人模型配置");
      setConfirmRemove(false);
      await load();
      window.dispatchEvent(new CustomEvent("learnmate:library-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "移除失败");
    } finally {
      setSaving(false);
    }
  };

  const effective = data?.effective;
  const buttonLabel = effective
    ? effective.source === "personal"
      ? "个人模型"
      : effective.source === "env"
        ? "默认模型"
        : "本地演示"
    : "模型设置";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[10.5px] font-medium text-slate-400 transition hover:border-accent/25 hover:bg-accent/[0.045] hover:text-slate-100",
          className
        )}
        title="配置我的外部大模型"
      >
        <Cpu className="h-3.5 w-3.5 text-accent-soft" />
        <span className="hidden sm:inline">模型设置</span>
        <span className="text-slate-600">·</span>
        <span className="max-w-[84px] truncate text-slate-300">
          {buttonLabel}
        </span>
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="AI 大模型管理"
        description="配置你自己的 OpenAI 兼容模型服务。密钥仅加密保存在服务端，只有当前账号的问答与 Agent 会调用。"
        className="max-w-xl"
        footer={
          <>
            {data?.personal ? (
              <Button
                variant={confirmRemove ? "danger" : "ghost"}
                size="sm"
                onClick={() => void remove()}
                disabled={saving}
                className="mr-auto"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {confirmRemove ? "确认移除" : "移除个人模型"}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              关闭
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void test()}
              disabled={testing || saving}
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              测试连接
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => void save()}
              disabled={saving || testing}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              保存配置
            </Button>
          </>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在读取模型配置…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
              <span className="text-[10.5px] text-slate-500">当前生效</span>
              <Badge
                variant={
                  effective?.source === "personal"
                    ? "mint"
                    : effective?.source === "env"
                      ? "cyan"
                      : "amber"
                }
              >
                {effective?.source === "personal"
                  ? "我的个人模型"
                  : effective?.source === "env"
                    ? "服务端默认模型"
                    : "本地演示"}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-right font-mono text-[10.5px] text-slate-400">
                {effective?.modelName ?? "local"}
              </span>
              {data?.personal ? (
                <span className="w-full text-[9.5px] text-slate-600">
                  已保存密钥：{data.personal.apiKeyHint} · 修改 Base URL
                  时需重新输入密钥
                </span>
              ) : null}
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold text-slate-500">
                快速选择服务商
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => {
                  const active =
                    form.baseURL === preset.baseURL && form.model === preset.model;
                  return (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setForm((previous) => ({
                          ...previous,
                          baseURL: preset.baseURL,
                          model: preset.model,
                        }));
                        setTestResult(null);
                        setError(null);
                      }}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[10.5px] transition",
                        active
                          ? "border-accent/30 bg-accent/[0.1] text-accent-soft"
                          : "border-white/[0.07] bg-white/[0.02] text-slate-500 hover:border-white/15 hover:text-slate-300"
                      )}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-medium text-slate-500">
                Base URL
              </span>
              <input
                value={form.baseURL}
                onChange={(event) => {
                  setForm((previous) => ({
                    ...previous,
                    baseURL: event.target.value,
                  }));
                  setTestResult(null);
                }}
                placeholder="https://api.deepseek.com/v1"
                className={inputClass}
                spellCheck={false}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-medium text-slate-500">
                  模型名称
                </span>
                <input
                  value={form.model}
                  onChange={(event) => {
                    setForm((previous) => ({
                      ...previous,
                      model: event.target.value,
                    }));
                    setTestResult(null);
                  }}
                  placeholder="deepseek-chat"
                  className={inputClass}
                  spellCheck={false}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-medium text-slate-500">
                  显示名称（可选）
                </span>
                <input
                  value={form.label}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      label: event.target.value,
                    }))
                  }
                  placeholder="例如：我的 DeepSeek"
                  maxLength={40}
                  className={inputClass}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-medium text-slate-500">
                API Key
              </span>
              <input
                type="password"
                value={form.apiKey}
                onChange={(event) => {
                  setForm((previous) => ({
                    ...previous,
                    apiKey: event.target.value,
                  }));
                  setTestResult(null);
                }}
                placeholder={
                  data?.personal
                    ? `留空则保持已保存密钥（${data.personal.apiKeyHint}）`
                    : "sk-..."
                }
                autoComplete="off"
                className={inputClass}
                spellCheck={false}
              />
            </label>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-3.5 py-2.5 text-[11px] leading-relaxed text-rose-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            ) : null}

            {testResult ? (
              <div className="flex items-start gap-2 rounded-xl border border-mint/20 bg-mint/[0.06] px-3.5 py-2.5 text-[11px] leading-relaxed text-mint-soft">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {testResult}
              </div>
            ) : null}

            <p className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-slate-600">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
              密钥使用 AES-256-GCM 加密写入服务端数据文件，接口只返回掩码；其他账号无法读取或借用。
              若未配置个人模型，则使用服务端环境变量中的默认模型。
            </p>
          </div>
        )}
      </Dialog>
    </>
  );
}
