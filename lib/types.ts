export type AiMode = "deepseek" | "local";

export type KnowledgeFileType =
  | "pdf"
  | "docx"
  | "markdown"
  | "text"
  | "html"
  | "image";

export interface ModelRuntimeConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
}

export interface UserModelInfo {
  baseURL: string;
  model: string;
  label: string;
  apiKeyHint: string;
  temperature: number;
  updatedAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  model: UserModelInfo | null;
}

export interface Source {
  id: string;
  docId: string;
  docName: string;
  fileType?: KnowledgeFileType;
  chunkIndex: number;
  page: number;
  score: number;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: Source[];
  mode?: AiMode;
  modelLabel?: string;
  error?: string;
  pending?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export type DocStatus = "ready" | "processing" | "failed";

export interface KnowledgeDoc {
  id: string;
  ownerId: string;
  name: string;
  fileType?: KnowledgeFileType;
  size: number;
  pages: number;
  uploadedAt: string;
  status: DocStatus;
  chunkCount: number;
  charCount: number;
  isDemo?: boolean;
  error?: string;
}

export interface StoredChunk {
  id: string;
  ownerId: string;
  docId: string;
  docName: string;
  fileType?: KnowledgeFileType;
  page: number;
  index: number;
  content: string;
  embedding: number[];
}

export interface LibraryStats {
  docs: number;
  chunks: number;
  characters: number;
  dim: number;
  embedding: "remote" | "local";
  llm: "deepseek" | "demo";
  modelLabel?: string;
  personalModel?: boolean;
}

export interface LibraryResponse {
  docs: KnowledgeDoc[];
  stats: LibraryStats;
  storage: "local" | "memory";
}

export interface ChunkPreview {
  id: string;
  index: number;
  page: number;
  content: string;
  chars: number;
}

export type AgentTool = "summary" | "quiz" | "review" | "answer";

export type StepStatus = "pending" | "running" | "done" | "error";

export interface AgentStepPlan {
  id: string;
  tool: AgentTool;
  title: string;
  description: string;
}

export interface AgentStepState extends AgentStepPlan {
  status: StepStatus;
  detail?: string;
  durationMs?: number;
}

export interface QuizOption {
  key: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  type: "choice" | "short" | "code";
  question: string;
  options?: QuizOption[];
  answer: string;
  explanation: string;
  difficulty: "基础" | "进阶" | "挑战";
  knowledge?: string;
  language?: "C" | "Python";
}

export interface QuizPayload {
  title: string;
  course?: string;
  questions: QuizQuestion[];
}

export interface SummarySection {
  title: string;
  points: string[];
}

export interface SummaryPayload {
  title: string;
  overview: string;
  sections: SummarySection[];
  keyTerms: { term: string; explanation: string }[];
  pitfalls: string[];
}

export type IssueSeverity = "error" | "warning" | "info";

export interface CodeIssue {
  severity: IssueSeverity;
  line?: number;
  title: string;
  detail: string;
  suggestion: string;
}

export interface CodeReviewPayload {
  language: "C" | "Python";
  score: number;
  summary: string;
  issues: CodeIssue[];
  lineNotes: { line: number; code: string; note: string }[];
  correctedCode?: string;
  knowledgePoints: string[];
}

export interface AnswerPayload {
  content: string;
}

export type AgentResult =
  | SummaryPayload
  | QuizPayload
  | CodeReviewPayload
  | AnswerPayload;

export type ChatSseEvent =
  | { type: "sources"; sources: Source[] }
  | {
      type: "meta";
      mode: AiMode;
      topK: number;
      elapsedMs?: number;
      modelLabel?: string;
    }
  | { type: "delta"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export type AgentSseEvent =
  | { type: "plan"; steps: AgentStepPlan[] }
  | { type: "step"; id: string; status: StepStatus; detail?: string; durationMs?: number }
  | { type: "delta"; id: string; text: string }
  | {
      type: "result";
      id: string;
      tool: AgentTool;
      payload: AgentResult;
    }
  | { type: "final"; text: string; mode: AiMode; modelLabel?: string }
  | { type: "error"; message: string }
  | { type: "done" };

export interface StatusResponse extends LibraryStats {
  ok: boolean;
  storage: "local" | "memory";
  maxUploadMb: number;
}
