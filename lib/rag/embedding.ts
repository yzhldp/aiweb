import { LOCAL_EMBEDDING_DIM } from "@/lib/constants";

export type EmbeddingMode = "remote" | "local";

export interface EmbeddingResult {
  vectors: number[][];
  mode: EmbeddingMode;
  dim: number;
}

interface WeightedToken {
  token: string;
  weight: number;
}

const STOP_UNIGRAMS = new Set(
  "的了和是在与及对为以中可这那个有也就都而及其或等被把从到向于".split("")
);

function fnv1a(input: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 导出给混合检索复用：中英文混合分词（含中文 unigram / bigram / trigram） */
export function tokenizeForSearch(text: string): WeightedToken[] {
  const normalized = text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ");
  const tokens: WeightedToken[] = [];

  const latin = normalized.match(/[a-z][a-z0-9_+#.-]{1,}/g) ?? [];
  for (const word of latin) {
    tokens.push({ token: word, weight: 1.35 });
    if (word.includes("_")) {
      for (const part of word.split("_")) {
        if (part.length >= 2) tokens.push({ token: part, weight: 1 });
      }
    }
  }

  const numbers = normalized.match(/\b\d{2,}\b/g) ?? [];
  for (const num of numbers) tokens.push({ token: num, weight: 0.8 });

  const hanSequences = normalized.match(/[\u3400-\u9fff]{1,}/g) ?? [];
  for (const seq of hanSequences) {
    for (let i = 0; i < seq.length; i++) {
      const char = seq[i];
      if (!STOP_UNIGRAMS.has(char)) {
        tokens.push({ token: char, weight: 0.32 });
      }
    }
    for (let i = 0; i < seq.length - 1; i++) {
      tokens.push({ token: seq.slice(i, i + 2), weight: 1.05 });
    }
    for (let i = 0; i < seq.length - 2; i++) {
      tokens.push({ token: seq.slice(i, i + 3), weight: 0.62 });
    }
  }

  return tokens;
}

function localEmbedding(text: string, dim = LOCAL_EMBEDDING_DIM): number[] {
  const vector = new Array<number>(dim).fill(0);
  const tokens = tokenizeForSearch(text);

  for (const { token, weight } of tokens) {
    const h1 = fnv1a(token);
    const h2 = fnv1a(token, 0x9e3779b9);
    const i1 = h1 % dim;
    const i2 = h2 % dim;
    const sign1 = (h1 & 1) === 0 ? 1 : -1;
    const sign2 = (h2 & 1) === 0 ? 1 : -1;
    vector[i1] += weight * sign1;
    vector[i2] += weight * 0.55 * sign2;
  }

  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vector[i] /= norm;
  }
  return vector;
}

export function getEmbeddingStatus(): { mode: EmbeddingMode; dim: number; model: string } {
  const apiKey = process.env.EMBEDDING_API_KEY?.trim();
  if (apiKey) {
    return {
      mode: "remote",
      dim: Number(process.env.EMBEDDING_DIM ?? 1024),
      model: process.env.EMBEDDING_MODEL ?? "BAAI/bge-m3",
    };
  }
  return {
    mode: "local",
    dim: LOCAL_EMBEDDING_DIM,
    model: "learnmate-local-hash-v1",
  };
}

async function remoteEmbed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.EMBEDDING_API_KEY!.trim();
  const baseURL = (process.env.EMBEDDING_BASE_URL ?? "https://api.siliconflow.cn/v1").replace(
    /\/+$/,
    ""
  );
  const model = process.env.EMBEDDING_MODEL ?? "BAAI/bge-m3";
  const vectors: number[][] = [];
  const batchSize = 16;

  for (let start = 0; start < texts.length; start += batchSize) {
    const batch = texts.slice(start, start + batchSize);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch(`${baseURL}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: batch, encoding_format: "float" }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Embedding API ${res.status}: ${detail.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        data?: { embedding?: number[]; index?: number }[];
      };
      if (!Array.isArray(json.data) || json.data.length !== batch.length) {
        throw new Error("Embedding API 返回数据格式异常");
      }
      const ordered = [...json.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      for (const item of ordered) {
        if (!Array.isArray(item.embedding) || item.embedding.length < 8) {
          throw new Error("Embedding API 返回了空向量");
        }
        vectors.push(item.embedding);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return vectors;
}

/**
 * 统一的向量化入口：
 * - 配置 EMBEDDING_API_KEY 时调用 OpenAI 兼容的 Embedding 服务；
 * - 未配置或调用失败时，回退到内置的本地哈希向量引擎，保证系统离线可用。
 */
export async function embedTexts(
  texts: string[],
  purpose: "document" | "query" = "document"
): Promise<EmbeddingResult> {
  const status = getEmbeddingStatus();

  if (status.mode === "remote") {
    try {
      const vectors = await remoteEmbed(texts);
      return { vectors, mode: "remote", dim: vectors[0]?.length ?? status.dim };
    } catch (error) {
      console.warn(
        `[learnmate] Remote embedding failed (${purpose}), falling back to local engine:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  const vectors = texts.map((text) => localEmbedding(text, LOCAL_EMBEDDING_DIM));
  return { vectors, mode: "local", dim: LOCAL_EMBEDDING_DIM };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
