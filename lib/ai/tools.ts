import {
  buildLocalChatAnswer,
  buildLocalCodeReview,
  buildLocalQuiz,
  buildLocalSummary,
} from "@/lib/ai/local";
import { asRecord, asString, asStringArray, parseJsonLoose } from "@/lib/ai/json";
import { completeText, isLlmConfigured } from "@/lib/ai/provider";
import {
  buildQuizPrompt,
  buildReviewPrompt,
  buildRagPrompt,
  buildSummaryPrompt,
  QUIZ_SYSTEM_PROMPT,
  RAG_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import type {
  AnswerPayload,
  CodeIssue,
  CodeReviewPayload,
  IssueSeverity,
  ModelRuntimeConfig,
  QuizOption,
  QuizQuestion,
  QuizPayload,
  Source,
  SummaryPayload,
} from "@/lib/types";

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error("生成已取消");
    error.name = "AbortError";
    throw error;
  }
}

function normalizeSummary(raw: unknown): SummaryPayload | null {
  const record = asRecord(raw);
  if (!record) return null;
  const sectionsRaw = Array.isArray(record.sections) ? record.sections : [];
  const sections = sectionsRaw
    .map((item) => {
      const section = asRecord(item);
      if (!section) return null;
      const title = asString(section.title);
      const points = asStringArray(section.points, 6);
      if (!title || points.length === 0) return null;
      return { title, points };
    })
    .filter((item): item is { title: string; points: string[] } => Boolean(item));

  if (sections.length === 0) return null;

  const keyTermsRaw = Array.isArray(record.keyTerms) ? record.keyTerms : [];
  const keyTerms = keyTermsRaw
    .map((item) => {
      const entry = asRecord(item);
      if (!entry) return null;
      const term = asString(entry.term);
      const explanation = asString(entry.explanation);
      if (!term || !explanation) return null;
      return { term, explanation };
    })
    .filter((item): item is { term: string; explanation: string } => Boolean(item))
    .slice(0, 6);

  return {
    title: asString(record.title, "考点总结"),
    overview: asString(record.overview, "已根据课件内容整理核心考点。"),
    sections,
    keyTerms,
    pitfalls: asStringArray(record.pitfalls, 5),
  };
}

function normalizeOptions(raw: unknown): QuizOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const option = asRecord(item);
      if (option) {
        const key = asString(option.key).toUpperCase().slice(0, 1);
        const text = asString(option.text);
        if (/^[A-D]$/.test(key) && text) return { key, text };
        return null;
      }
      if (typeof item === "string" && item.trim()) {
        return null;
      }
      return null;
    })
    .filter((item): item is QuizOption => Boolean(item))
    .slice(0, 4);
}

function normalizeQuiz(raw: unknown): QuizPayload | null {
  const record = asRecord(raw);
  if (!record || !Array.isArray(record.questions)) return null;

  const questions: QuizQuestion[] = [];
  record.questions.forEach((item, index) => {
    const question = asRecord(item);
    if (!question) return;
    const typeRaw = asString(question.type);
    const type =
      typeRaw === "choice" || typeRaw === "short" || typeRaw === "code"
        ? typeRaw
        : null;
    if (!type) return;
    const prompt = asString(question.question);
    const answer = asString(question.answer);
    const explanation = asString(question.explanation);
    if (!prompt || !answer) return;

    const difficultyRaw = asString(question.difficulty);
    const difficulty =
      difficultyRaw === "基础" || difficultyRaw === "进阶" || difficultyRaw === "挑战"
        ? difficultyRaw
        : index < 2
          ? "基础"
          : index < 4
            ? "进阶"
            : "挑战";

    if (type === "choice") {
      const options = normalizeOptions(question.options);
      if (options.length < 3) return;
      let answerKey = answer.toUpperCase().slice(0, 1);
      if (!options.some((option) => option.key === answerKey)) {
        const matched = options.find(
          (option) =>
            option.text === answer ||
            option.text.includes(answer) ||
            answer.includes(option.text)
        );
        if (!matched) return;
        answerKey = matched.key;
      }
      questions.push({
        id: `q${questions.length + 1}`,
        type,
        question: prompt,
        options,
        answer: answerKey,
        explanation,
        difficulty,
        knowledge: asString(question.knowledge, "课件考点"),
      });
      return;
    }

    questions.push({
      id: `q${questions.length + 1}`,
      type,
      question: prompt,
      answer,
      explanation,
      difficulty,
      knowledge: asString(question.knowledge, "课件考点"),
      language:
        type === "code"
          ? asString(question.language).toLowerCase().includes("c")
            ? "C"
            : "Python"
          : undefined,
    });
  });

  if (questions.length < 3) return null;
  return {
    title: asString(record.title, "智能练习"),
    course: asString(record.course, "计算机专业课"),
    questions: questions.slice(0, 8),
  };
}

function normalizeSeverity(value: unknown): IssueSeverity {
  const raw = asString(value).toLowerCase();
  if (raw === "error" || raw === "warning" || raw === "info") return raw;
  return "info";
}

function normalizeReview(raw: unknown): CodeReviewPayload | null {
  const record = asRecord(raw);
  if (!record) return null;
  const scoreRaw = Number(record.score);
  const summary = asString(record.summary);
  if (!summary) return null;

  const issues: CodeIssue[] = (Array.isArray(record.issues) ? record.issues : [])
    .flatMap((item): CodeIssue[] => {
      const issue = asRecord(item);
      if (!issue) return [];
      const title = asString(issue.title);
      const detail = asString(issue.detail);
      if (!title || !detail) return [];
      const line = Number(issue.line);
      return [
        {
          severity: normalizeSeverity(issue.severity),
          line: Number.isFinite(line) && line > 0 ? Math.floor(line) : undefined,
          title,
          detail,
          suggestion: asString(issue.suggestion, "请结合上下文检查该位置。"),
        },
      ];
    })
    .slice(0, 12);

  const lineNotes = (Array.isArray(record.lineNotes) ? record.lineNotes : [])
    .map((item) => {
      const note = asRecord(item);
      if (!note) return null;
      const line = Number(note.line);
      const text = asString(note.note);
      if (!Number.isFinite(line) || !text) return null;
      return {
        line: Math.floor(line),
        code: asString(note.code, ""),
        note: text,
      };
    })
    .filter(
      (item): item is { line: number; code: string; note: string } =>
        Boolean(item)
    )
    .slice(0, 12);

  const language = asString(record.language).toUpperCase().includes("C")
    ? "C"
    : "Python";

  return {
    language,
    score: Number.isFinite(scoreRaw)
      ? Math.max(0, Math.min(100, Math.round(scoreRaw)))
      : 80,
    summary,
    issues,
    lineNotes,
    correctedCode: asString(record.correctedCode) || undefined,
    knowledgePoints: asStringArray(record.knowledgePoints, 8),
  };
}

export async function generateSummary(input: {
  instruction: string;
  sources: Source[];
  signal?: AbortSignal;
  llm?: ModelRuntimeConfig | null;
}): Promise<SummaryPayload> {
  if (isLlmConfigured(input.llm) && input.sources.length > 0) {
    try {
      const text = await completeText({
        system: SUMMARY_SYSTEM_PROMPT,
        prompt: buildSummaryPrompt(input.instruction, input.sources),
        signal: input.signal,
        model: input.llm,
        temperature: 0.25,
        maxTokens: 2400,
      });
      const parsed = parseJsonLoose(text);
      const normalized = normalizeSummary(parsed);
      if (normalized) return normalized;
      console.warn("[learnmate] summary JSON parse failed, using local fallback");
    } catch (error) {
      abortIfNeeded(input.signal);
      console.warn(
        "[learnmate] summary generation failed, using local fallback:",
        error instanceof Error ? error.message : error
      );
    }
  }
  return buildLocalSummary(input.instruction, input.sources);
}

export async function generateQuiz(input: {
  instruction: string;
  sources: Source[];
  signal?: AbortSignal;
  llm?: ModelRuntimeConfig | null;
}): Promise<QuizPayload> {
  if (isLlmConfigured(input.llm) && input.sources.length > 0) {
    try {
      const text = await completeText({
        system: QUIZ_SYSTEM_PROMPT,
        prompt: buildQuizPrompt(input.instruction, input.sources),
        signal: input.signal,
        model: input.llm,
        temperature: 0.3,
        maxTokens: 3200,
      });
      const parsed = parseJsonLoose(text);
      const normalized = normalizeQuiz(parsed);
      if (normalized) return normalized;
      console.warn("[learnmate] quiz JSON parse failed, using local fallback");
    } catch (error) {
      abortIfNeeded(input.signal);
      console.warn(
        "[learnmate] quiz generation failed, using local fallback:",
        error instanceof Error ? error.message : error
      );
    }
  }
  return buildLocalQuiz(input.instruction, input.sources);
}

export async function generateCodeReview(input: {
  code: string;
  language: "C" | "Python";
  instruction: string;
  sources: Source[];
  signal?: AbortSignal;
  llm?: ModelRuntimeConfig | null;
}): Promise<CodeReviewPayload> {
  if (isLlmConfigured(input.llm) && input.code.trim()) {
    try {
      const text = await completeText({
        system: REVIEW_SYSTEM_PROMPT,
        prompt: buildReviewPrompt({
          code: input.code.slice(0, 18_000),
          language: input.language,
          instruction: input.instruction,
          sources: input.sources,
        }),
        signal: input.signal,
        model: input.llm,
        temperature: 0.2,
        maxTokens: 3200,
      });
      const parsed = parseJsonLoose(text);
      const normalized = normalizeReview(parsed);
      if (normalized) return normalized;
      console.warn("[learnmate] review JSON parse failed, using local fallback");
    } catch (error) {
      abortIfNeeded(input.signal);
      console.warn(
        "[learnmate] review generation failed, using local fallback:",
        error instanceof Error ? error.message : error
      );
    }
  }
  return buildLocalCodeReview({
    code: input.code,
    language: input.language,
    sources: input.sources,
  });
}

export async function generateAnswer(input: {
  question: string;
  sources: Source[];
  signal?: AbortSignal;
  llm?: ModelRuntimeConfig | null;
}): Promise<AnswerPayload> {
  if (isLlmConfigured(input.llm) && input.sources.length > 0) {
    try {
      const text = await completeText({
        system: RAG_SYSTEM_PROMPT,
        prompt: buildRagPrompt(input.question, input.sources),
        signal: input.signal,
        model: input.llm,
        temperature: 0.3,
        maxTokens: 1800,
      });
      if (text.trim()) return { content: text.trim() };
    } catch (error) {
      abortIfNeeded(input.signal);
      console.warn(
        "[learnmate] answer generation failed, using local fallback:",
        error instanceof Error ? error.message : error
      );
    }
  }
  return { content: buildLocalChatAnswer(input.question, input.sources) };
}
