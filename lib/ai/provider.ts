import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, type CoreMessage } from "ai";
import type { ModelRuntimeConfig } from "@/lib/types";

export function getEnvModelConfig(): ModelRuntimeConfig | null {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseURL: (
      process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1"
    ).replace(/\/+$/, ""),
    model: process.env.DEEPSEEK_CHAT_MODEL?.trim() || "deepseek-chat",
  };
}

export function isLlmConfigured(config?: ModelRuntimeConfig | null) {
  return Boolean(config?.apiKey?.trim() || process.env.DEEPSEEK_API_KEY?.trim());
}

export function getLlmModelName(config?: ModelRuntimeConfig | null) {
  return (
    config?.model?.trim() ||
    process.env.DEEPSEEK_CHAT_MODEL?.trim() ||
    "deepseek-chat"
  );
}

function getModel(config?: ModelRuntimeConfig | null) {
  const runtime = config?.apiKey?.trim() ? config : getEnvModelConfig();
  if (!runtime?.apiKey) {
    throw new Error("未配置可用的大模型 API Key");
  }

  const provider = createOpenAI({
    apiKey: runtime.apiKey,
    baseURL: runtime.baseURL.replace(/\/+$/, ""),
    compatibility: "compatible",
  });

  return provider.chat(runtime.model);
}

export interface StreamCompletionOptions {
  system: string;
  messages: CoreMessage[];
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  model?: ModelRuntimeConfig | null;
}

export async function streamCompletion(
  options: StreamCompletionOptions,
  onDelta: (delta: string) => void
): Promise<string> {
  const result = streamText({
    model: getModel(options.model),
    system: options.system,
    messages: options.messages,
    temperature: options.model?.temperature ?? options.temperature ?? 0.35,
    maxTokens: options.maxTokens ?? 1800,
    abortSignal: options.signal,
  });

  let full = "";
  for await (const delta of result.textStream) {
    full += delta;
    onDelta(delta);
  }
  return full;
}

export interface CompleteOptions {
  system: string;
  prompt: string;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  model?: ModelRuntimeConfig | null;
}

export async function completeText(options: CompleteOptions): Promise<string> {
  const result = await generateText({
    model: getModel(options.model),
    system: options.system,
    prompt: options.prompt,
    temperature: options.model?.temperature ?? options.temperature ?? 0.2,
    maxTokens: options.maxTokens ?? 2600,
    abortSignal: options.signal,
  });
  return result.text;
}
