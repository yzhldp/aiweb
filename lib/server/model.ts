import { getEnvModelConfig } from "@/lib/ai/provider";
import {
  getUserModelInfo,
  getUserRuntimeModel,
  type SaveModelInput,
} from "@/lib/server/accounts";
import type { ModelRuntimeConfig } from "@/lib/types";

export type ModelSource = "personal" | "env" | "none";

export interface ResolvedModel {
  config: ModelRuntimeConfig | null;
  source: ModelSource;
  label: string;
  modelName: string;
}

// Base URL 由用户填写，必须拦截云元数据与保留地址，避免 SSRF 和内网探测。
const BLOCKED_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.goog",
  "100.100.100.200",
]);

function assertSafeBaseURL(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Base URL 不是合法地址");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Base URL 仅支持 http / https");
  }
  if (url.username || url.password) {
    throw new Error("Base URL 不能包含用户名或密码");
  }
  if (url.search || url.hash) {
    throw new Error("Base URL 不能包含查询参数或锚点");
  }
  const host = url.hostname.toLowerCase();
  if (
    host.startsWith("169.254.") ||
    host === "0.0.0.0" ||
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".internal")
  ) {
    throw new Error("不允许使用内网元数据或保留地址");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function parseModelInput(raw: unknown): SaveModelInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("模型配置格式错误");
  }
  const body = raw as Record<string, unknown>;
  const baseURL = typeof body.baseURL === "string" ? body.baseURL.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const temperatureRaw = Number(body.temperature);

  if (!baseURL) throw new Error("请填写 Base URL");
  if (!model) throw new Error("请填写模型名称");
  if (model.length > 120) throw new Error("模型名称过长");
  if (apiKey.length > 512) throw new Error("API Key 过长");

  const normalizedBaseURL = assertSafeBaseURL(baseURL);
  const temperature = Number.isFinite(temperatureRaw)
    ? Math.max(0, Math.min(1.5, temperatureRaw))
    : 0.3;

  return {
    baseURL: normalizedBaseURL,
    model,
    label: (label || model).slice(0, 40),
    temperature,
    apiKey: apiKey || undefined,
  };
}

export async function resolveModelForUser(
  userId: string
): Promise<ResolvedModel> {
  const personal = await getUserRuntimeModel(userId);
  if (personal) {
    const info = await getUserModelInfo(userId);
    return {
      config: personal,
      source: "personal",
      label: info?.label || personal.model,
      modelName: personal.model,
    };
  }

  const env = getEnvModelConfig();
  if (env) {
    return {
      config: env,
      source: "env",
      label: env.model,
      modelName: env.model,
    };
  }

  return {
    config: null,
    source: "none",
    label: "本地演示",
    modelName: "local",
  };
}

export async function testModelConnection(config: ModelRuntimeConfig) {
  const endpoint = `${config.baseURL.replace(/\/+$/, "")}/models`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      const detail = text.replace(/\s+/g, " ").slice(0, 160);
      throw new Error(
        `连接失败（HTTP ${response.status}）${detail ? `：${detail}` : ""}`
      );
    }
    let models: string[] = [];
    try {
      const payload = JSON.parse(text) as { data?: { id?: unknown }[] };
      models = (payload.data ?? [])
        .map((item) => item.id)
        .filter((id): id is string => typeof id === "string")
        .slice(0, 12);
    } catch {
      // 部分兼容服务返回非 JSON，只要状态码成功即可视为连通
    }
    return { ok: true as const, models };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("连接超时，请检查 Base URL 或网络");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
