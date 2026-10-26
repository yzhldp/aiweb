import type { NextRequest } from "next/server";
import { buildAgentFinal, planAgent } from "@/lib/agent/planner";
import {
  generateAnswer,
  generateCodeReview,
  generateQuiz,
  generateSummary,
} from "@/lib/ai/tools";
import { isLlmConfigured } from "@/lib/ai/provider";
import { retrieveSources } from "@/lib/rag/retrieve";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { resolveModelForUser } from "@/lib/server/model";
import {
  checkRateLimit,
  friendlyError,
  getClientIp,
  rateLimitResponse,
} from "@/lib/server/rate-limit";
import { createSseResponse } from "@/lib/server/sse";
import type {
  AgentSseEvent,
  AgentStepState,
  AnswerPayload,
  CodeReviewPayload,
  QuizPayload,
  SummaryPayload,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AgentBody {
  instruction?: string;
  code?: string;
  language?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stepDetail(
  tool: AgentStepState["tool"],
  payload: SummaryPayload | QuizPayload | CodeReviewPayload | AnswerPayload
) {
  if (tool === "summary") {
    const summary = payload as SummaryPayload;
    return `生成 ${summary.sections.length} 个知识板块、${summary.keyTerms.length} 个核心术语`;
  }
  if (tool === "quiz") {
    const quiz = payload as QuizPayload;
    return quiz.questions.length > 0
      ? `生成 ${quiz.questions.length} 道分层练习，等待作答`
      : "知识库资料不足，未能生成有效题目";
  }
  if (tool === "review") {
    const review = payload as CodeReviewPayload;
    return review.issues.length > 0
      ? `发现 ${review.issues.length} 个问题，综合评分 ${review.score}`
      : `未发现明显问题，综合评分 ${review.score}`;
  }
  const answer = payload as AnswerPayload;
  return `已生成 ${answer.content.length} 字的结构化回答`;
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const ip = getClientIp(request);
  const limit = checkRateLimit(`agent:${ip}`, 20, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  let body: AgentBody;
  try {
    body = (await request.json()) as AgentBody;
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.slice(0, 20_000) : "";
  const language =
    typeof body.language === "string" && body.language.toLowerCase().includes("c")
      ? "C"
      : "Python";
  const instruction = (
    typeof body.instruction === "string" ? body.instruction : ""
  ).trim();

  if (!instruction && !code) {
    return Response.json(
      { error: "请输入学习任务，或粘贴需要批改的代码" },
      { status: 400 }
    );
  }
  if (instruction.length > 2000) {
    return Response.json(
      { error: "指令过长，请控制在 2000 字以内" },
      { status: 400 }
    );
  }

  const finalInstruction =
    instruction || "请批改我提交的代码，指出语法错误、逻辑漏洞并逐行讲解。";
  const plan = planAgent(finalInstruction, code.trim().length > 0);

  const codeTokens = code
    .match(/[A-Za-z_][A-Za-z0-9_]{2,}/g)
    ?.slice(0, 8)
    .join(" ");
  const retrievalQuery = `${finalInstruction} ${
    codeTokens ? `代码 ${codeTokens}` : ""
  }`.slice(0, 800);

  return createSseResponse(
    async ({ send, signal }) => {
      const emit = (event: AgentSseEvent) => send(event);
      const states: AgentStepState[] = plan.map((step) => ({
        ...step,
        status: "pending",
      }));

      try {
        emit({ type: "plan", steps: plan });
        const [sources, model] = await Promise.all([
          retrieveSources(retrievalQuery, { topK: 8, ownerId: user.id }),
          resolveModelForUser(user.id),
        ]);
        const configured = isLlmConfigured(model.config);
        const mode = configured ? "deepseek" : "local";
        const modelLabel = configured ? model.label : "本地演示";
        let hasQuiz = false;

        for (let index = 0; index < states.length; index++) {
          if (signal?.aborted) return;
          const step = states[index];
          const startedAt = Date.now();
          step.status = "running";
          emit({ type: "step", id: step.id, status: "running" });
          await sleep(140);

          try {
            let payload: SummaryPayload | QuizPayload | CodeReviewPayload | AnswerPayload;

            if (step.tool === "summary") {
              payload = await generateSummary({
                instruction: finalInstruction,
                sources,
                signal,
                llm: model.config,
              });
            } else if (step.tool === "quiz") {
              payload = await generateQuiz({
                instruction: finalInstruction,
                sources,
                signal,
                llm: model.config,
              });
              hasQuiz = (payload as QuizPayload).questions.length > 0;
            } else if (step.tool === "review") {
              payload = await generateCodeReview({
                code,
                language,
                instruction: finalInstruction,
                sources,
                signal,
                llm: model.config,
              });
            } else {
              payload = await generateAnswer({
                question: finalInstruction,
                sources,
                signal,
                llm: model.config,
              });
            }

            if (signal?.aborted) return;
            const detail = stepDetail(step.tool, payload);
            step.status = "done";
            step.detail = detail;
            step.durationMs = Date.now() - startedAt;
            emit({
              type: "result",
              id: step.id,
              tool: step.tool,
              payload,
            });
            emit({
              type: "step",
              id: step.id,
              status: "done",
              detail,
              durationMs: step.durationMs,
            });
          } catch (error) {
            if (signal?.aborted) return;
            console.error(`[learnmate] agent step ${step.tool} failed`, error);
            const message = friendlyError(error, `${step.title}执行失败`);
            step.status = "error";
            step.detail = message;
            step.durationMs = Date.now() - startedAt;
            emit({
              type: "step",
              id: step.id,
              status: "error",
              detail: message,
              durationMs: step.durationMs,
            });
          }
          await sleep(80);
        }

        emit({
          type: "final",
          text: buildAgentFinal({
            steps: states,
            mode,
            hasSources: sources.length > 0,
            hasQuiz,
          }),
          mode,
          modelLabel,
        });
      } catch (error) {
        if (signal?.aborted) return;
        console.error("[learnmate] agent error", error);
        emit({ type: "error", message: friendlyError(error) });
      }
    },
    request.signal
  );
}
