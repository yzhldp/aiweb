import {
  cosineSimilarity,
  embedTexts,
  tokenizeForSearch,
} from "@/lib/rag/embedding";
import { getInternalChunks } from "@/lib/server/store";
import { DEFAULT_TOP_K } from "@/lib/constants";
import { fileLocationLabel } from "@/lib/file-types";
import type { Source } from "@/lib/types";

const tokenCache = new Map<string, Map<string, number>>();

function lexicalWeights(text: string) {
  const weights = new Map<string, number>();
  for (const { token, weight } of tokenizeForSearch(text)) {
    weights.set(token, Math.max(weights.get(token) ?? 0, weight));
  }
  return weights;
}

function chunkTokenWeights(id: string, content: string) {
  const cached = tokenCache.get(id);
  if (cached) return cached;
  const weights = lexicalWeights(content);
  tokenCache.set(id, weights);
  return weights;
}

function lexicalScore(
  queryWeights: Map<string, number>,
  chunkWeights: Map<string, number>
) {
  if (queryWeights.size === 0) return 0;
  let total = 0;
  let matched = 0;
  for (const [token, weight] of queryWeights) {
    total += weight;
    const chunkWeight = chunkWeights.get(token);
    if (chunkWeight !== undefined) {
      matched += weight * Math.min(1, chunkWeight / weight);
    }
  }
  return total > 0 ? matched / total : 0;
}

const STOP_PHRASES =
  /请|帮我|一下|什么|为什么|怎么|如何|哪些|区别|详细|解释|说明|结合|知识库|内容|同学|老师|吗|呢|？|\?/g;

function normalizeQuery(query: string) {
  return query
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(STOP_PHRASES, "");
}

export interface RetrieveOptions {
  ownerId: string;
  topK?: number;
  minScore?: number;
}

export async function retrieveSources(
  query: string,
  options: RetrieveOptions
): Promise<Source[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const topK = Math.max(1, Math.min(options.topK ?? DEFAULT_TOP_K, 10));
  const minScore = options.minScore ?? Number(process.env.RAG_MIN_SCORE ?? 0.08);
  const chunks = await getInternalChunks(options.ownerId);
  if (chunks.length === 0) return [];

  const { vectors } = await embedTexts([trimmed], "query");
  const queryVector = vectors[0] ?? [];
  const queryWeights = lexicalWeights(trimmed);
  const compactQuery = normalizeQuery(trimmed);

  const scored = chunks.map((chunk) => {
    const chunkWeights = chunkTokenWeights(chunk.id, chunk.content);
    const vectorScore = Math.max(
      0,
      cosineSimilarity(queryVector, chunk.embedding)
    );
    const lexical = lexicalScore(queryWeights, chunkWeights);
    const phraseBoost =
      compactQuery.length >= 3 &&
      chunk.content.toLowerCase().replace(/\s+/g, "").includes(compactQuery)
        ? 0.12
        : 0;
    // 向量负责语义召回，关键词弥补专有名词与缩写，短语命中再给小幅加权。
    const score = Math.min(
      1,
      vectorScore * 0.68 + lexical * 0.32 + phraseBoost
    );
    return { chunk, score, lexical, vectorScore };
  });

  // 重叠切片可能产生相同原文，按内容去重并保留得分更高的片段。
  const unique = new Map<string, Source>();
  for (const item of scored) {
    if (item.score < minScore) continue;
    const source: Source = {
      id: item.chunk.id,
      docId: item.chunk.docId,
      docName: item.chunk.docName,
      fileType: item.chunk.fileType,
      chunkIndex: item.chunk.index,
      page: item.chunk.page,
      score: Number(item.score.toFixed(4)),
      content: item.chunk.content,
    };
    const existing = unique.get(source.content);
    if (!existing || existing.score < source.score) {
      unique.set(source.content, source);
    }
  }

  return [...unique.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function formatSourcesForPrompt(sources: Source[]) {
  return sources
    .map(
      (source, i) =>
        `[${i + 1}] 文档：《${source.docName}》 ${fileLocationLabel(
          source.docName,
          source.fileType,
          source.page,
          source.chunkIndex
        )}\n${source.content}`
    )
    .join("\n\n---\n\n");
}
