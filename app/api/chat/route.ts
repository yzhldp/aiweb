import type { CoreMessage } from "ai";
import type { NextRequest } from "next/server";
import {
  buildLocalChatAnswer,
} from "@/lib/ai/local";
import { buildRagPrompt, RAG_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { isLlmConfigured, streamCompletion } from "@/lib/ai/provider";
import { DEFAULT_TOP_K } from "@/lib/constants";
import { formatSourcesForPrompt, retrieveSources } from "@/lib/rag/retrieve";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { resolveModelForUser } from "@/lib/server/model";
import {
  checkRateLimit,
  friendlyError,
  getClientIp,
  rateLimitResponse,
} from "@/lib/server/rate-limit";
import { createSseResponse } from "@/lib/server/sse";
import type { AiMode, ChatSseEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatBody {
  messages?: { role?: string; content?: string }[];
  topK?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamLocal(
  text: string,
  send: (event: ChatSseEvent) => void,
  signal?: AbortSignal
) {
  const characters = Array.from(text);
  const chunkSize = 4;
  for (let i = 0; i < characters.length; i += chunkSize) {
    if (signal?.aborted) return;
    send({ type: "delta", text: characters.slice(i, i + chunkSize).join("") });
    await sleep(8);
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const ip = getClientIp(request);
  const limit = checkRateLimit(`chat:${ip}`, 40, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const cleaned = messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content!.trim().slice(0, 4000),
    }));

  const last = cleaned[cleaned.length - 1];
  if (!last || last.role !== "user") {
    return Response.json(
      { error: "请先输入一个专业课问题" },
      { status: 400 }
    );
  }
  if (last.content.length > 2000) {
    return Response.json(
      { error: "问题过长，请控制在 2000 字以内" },
      { status: 400 }
    );
  }

  const topK = Math.max(
    1,
    Math.min(Number(body.topK) || DEFAULT_TOP_K, 10)
  );
  const history = cleaned.slice(0, -1).slice(-6);
  const question = last.content;

  let retrievalQuery = question;
  if (question.length < 18) {
    const previousUser = [...history].reverse().find((item) => item.role === "user");
    if (previousUser) retrievalQuery = `${previousUser.content} ${question}`;
  }

  const [sources, model] = await Promise.all([
    retrieveSources(retrievalQuery, { topK, ownerId: user.id }),
    resolveModelForUser(user.id),
  ]);
  const configured = isLlmConfigured(model.config);

  return createSseResponse(
    async ({ send, signal }) => {
      const emit = (event: ChatSseEvent) => send(event);

      try {
        emit({ type: "sources", sources });
        if (configured) {
          emit({
            type: "meta",
            mode: "deepseek",
            topK,
            modelLabel: model.label,
          });
        }

        const localFallback = async (
          mode: AiMode,
          notice?: string,
          modelLabel = "本地演示"
        ) => {
          emit({ type: "meta", mode, topK, modelLabel });
          if (notice) emit({ type: "delta", text: notice });
          const text = buildLocalChatAnswer(question, sources);
          await streamLocal(text, emit, signal);
        };

        if (!configured) {
          await localFallback("local");
          return;
        }

        if (sources.length === 0) {
          await localFallback(
            "local",
            "> 知识库中没有检索到高相关片段，已切换为本地兜底回答。\n\n"
          );
          return;
        }

        const prompt = buildRagPrompt(question, sources);
        const coreMessages: CoreMessage[] = [
          ...history.map((item) => ({
            role: item.role,
            content: item.content,
          })),
          { role: "user", content: prompt },
        ];

        let started = false;
        try {
          await streamCompletion(
            {
              system: RAG_SYSTEM_PROMPT,
              messages: coreMessages,
              signal,
              temperature: 0.3,
              maxTokens: 1800,
              model: model.config,
            },
            (delta) => {
              started = true;
              emit({ type: "delta", text: delta });
            }
          );
        } catch (error) {
          if (signal?.aborted) return;
          if (!started) {
            await localFallback(
              "local",
              "> 外部大模型服务暂时不可用，已自动切换为本地检索模式。\n\n"
            );
            return;
          }
          throw error;
        }
      } catch (error) {
        if (signal?.aborted) return;
        console.error("[learnmate] chat stream error", error);
        emit({ type: "error", message: friendlyError(error) });
      }
    },
    request.signal
  );
}

export async function GET() {
  return Response.json({
    ok: true,
    endpoint: "/api/chat",
    promptContextPreview: formatSourcesForPrompt([]) || "POST messages to stream",
  });
}
