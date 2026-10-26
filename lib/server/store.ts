import { promises as fs } from "fs";
import path from "path";
import { DEMO_DOCS, type DemoDoc } from "@/lib/demo-data";
import { inferFileType } from "@/lib/file-types";
import { chunkText, cleanExtractedText, stripDocumentExt } from "@/lib/rag/chunk";
import {
  embedTexts,
  getEmbeddingStatus,
  type EmbeddingMode,
} from "@/lib/rag/embedding";
import { dataDir, isMemoryStorage } from "@/lib/server/data-dir";
import type {
  ChunkPreview,
  KnowledgeDoc,
  KnowledgeFileType,
  LibraryStats,
  StoredChunk,
} from "@/lib/types";

interface StoreData {
  version: 2;
  initialized: boolean;
  embeddingMode: EmbeddingMode;
  dim: number;
  docs: KnowledgeDoc[];
  chunks: StoredChunk[];
}

export const PUBLIC_OWNER = "public";

let cache: StoreData | null = null;
let loadPromise: Promise<StoreData> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();
let storageMode: "local" | "memory" = isMemoryStorage() ? "memory" : "local";

function storePath() {
  return path.join(dataDir(), "store.json");
}

async function persist(data: StoreData) {
  if (storageMode === "memory") return;
  try {
    await fs.mkdir(dataDir(), { recursive: true });
    const tmp = path.join(dataDir(), `store.${process.pid}.${Date.now()}.tmp`);
    await fs.writeFile(tmp, JSON.stringify(data), "utf8");
    await fs.rename(tmp, storePath());
  } catch (error) {
    storageMode = "memory";
    console.warn("[learnmate] 本地持久化不可用，已切换为内存存储：", error);
  }
}

function emptyStore(): StoreData {
  const status = getEmbeddingStatus();
  return {
    version: 2,
    initialized: false,
    embeddingMode: status.mode,
    dim: status.dim,
    docs: [],
    chunks: [],
  };
}

function normalizeStore(
  value: unknown
): { data: StoreData; changed: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 && raw.version !== 2) return null;
  if (
    !Array.isArray(raw.docs) ||
    !Array.isArray(raw.chunks) ||
    typeof raw.initialized !== "boolean"
  ) {
    return null;
  }

  const status = getEmbeddingStatus();
  let changed = raw.version !== 2;

  const docs = (raw.docs as KnowledgeDoc[]).map((doc) => {
    const ownerId =
      typeof doc.ownerId === "string" && doc.ownerId ? doc.ownerId : PUBLIC_OWNER;
    const fileType = inferFileType(doc.name, doc.fileType);
    if (ownerId !== doc.ownerId || fileType !== doc.fileType) changed = true;
    return { ...doc, ownerId, fileType };
  });

  const chunks = (raw.chunks as StoredChunk[]).map((chunk) => {
    const ownerId =
      typeof chunk.ownerId === "string" && chunk.ownerId
        ? chunk.ownerId
        : PUBLIC_OWNER;
    const fileType = inferFileType(chunk.docName, chunk.fileType);
    if (ownerId !== chunk.ownerId || fileType !== chunk.fileType) changed = true;
    return { ...chunk, ownerId, fileType };
  });

  return {
    data: {
      version: 2,
      initialized: raw.initialized,
      embeddingMode: (raw.embeddingMode as EmbeddingMode) ?? status.mode,
      dim: typeof raw.dim === "number" ? raw.dim : status.dim,
      docs,
      chunks,
    },
    changed,
  };
}

async function readFromDisk(): Promise<{
  data: StoreData;
  changed: boolean;
}> {
  try {
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeStore(parsed);
    if (!normalized) throw new Error("invalid store schema");
    return normalized;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn("[learnmate] 读取本地知识库失败，将重新初始化：", error);
      try {
        await fs.rename(storePath(), `${storePath()}.corrupt-${Date.now()}`);
      } catch {
        // ignore backup failure
      }
    }
    return { data: emptyStore(), changed: false };
  }
}

interface PreparedDoc {
  doc: KnowledgeDoc;
  chunks: StoredChunk[];
}

async function prepareDocuments(
  demos: (DemoDoc & { isDemo?: boolean; uploadedAt?: string })[],
  ownerId: string,
  indexOffset = 0
): Promise<PreparedDoc[]> {
  const prepared: PreparedDoc[] = [];

  for (let d = 0; d < demos.length; d++) {
    const demo = demos[d];
    const content = cleanExtractedText(demo.content, "pdf");
    const drafts = chunkText(content, demo.pages);
    if (drafts.length === 0) continue;

    const { vectors } = await embedTexts(
      drafts.map((draft) => draft.content),
      "document"
    );
    const docId = `doc_${Date.now().toString(36)}_${indexOffset + d}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const now = demo.uploadedAt ?? new Date().toISOString();

    const doc: KnowledgeDoc = {
      id: docId,
      ownerId,
      name: demo.name,
      fileType: "pdf",
      size: Buffer.byteLength(demo.content, "utf8"),
      pages: demo.pages,
      uploadedAt: now,
      status: "ready",
      chunkCount: drafts.length,
      charCount: content.length,
      isDemo: demo.isDemo ?? false,
    };

    const chunks: StoredChunk[] = drafts.map((draft, i) => ({
      id: `${docId}_c${draft.index}`,
      ownerId,
      docId,
      docName: demo.name,
      fileType: "pdf",
      page: draft.page,
      index: draft.index,
      content: draft.content,
      embedding: vectors[i] ?? [],
    }));

    prepared.push({ doc, chunks });
  }

  return prepared;
}

function buildDemoDocs(): (DemoDoc & { isDemo: true; uploadedAt: string })[] {
  const day = 24 * 60 * 60 * 1000;
  return DEMO_DOCS.map((doc, i) => ({
    ...doc,
    isDemo: true,
    uploadedAt: new Date(Date.now() - (DEMO_DOCS.length - i) * day).toISOString(),
  }));
}

async function createInitialStore(): Promise<StoreData> {
  const base = emptyStore();
  base.initialized = true;

  if (process.env.AUTO_SEED_DEMO === "false") {
    return base;
  }

  const prepared = await prepareDocuments(buildDemoDocs(), PUBLIC_OWNER);
  for (const item of prepared) {
    base.docs.push(item.doc);
    base.chunks.push(...item.chunks);
  }
  const status = getEmbeddingStatus();
  base.embeddingMode = status.mode;
  base.dim = base.chunks[0]?.embedding.length ?? status.dim;
  return base;
}

async function getStore(): Promise<StoreData> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      const { data, changed } = await readFromDisk();
      let current = data;
      if (!current.initialized) {
        current = await createInitialStore();
        await persist(current);
      } else if (changed) {
        await persist(current);
      }
      cache = current;
      return current;
    })();
  }
  return loadPromise;
}

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function canAccess(ownerId: string, userId: string) {
  return ownerId === PUBLIC_OWNER || ownerId === userId;
}

function visibleDocs(data: StoreData, userId: string) {
  return data.docs.filter((doc) => canAccess(doc.ownerId, userId));
}

function sortDocs(docs: KnowledgeDoc[]) {
  return [...docs].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

function computeStats(data: StoreData, userId: string): LibraryStats {
  const status = getEmbeddingStatus();
  const docs = visibleDocs(data, userId);
  const docIds = new Set(docs.map((doc) => doc.id));
  const chunks = data.chunks.filter((chunk) => docIds.has(chunk.docId));
  return {
    docs: docs.length,
    chunks: chunks.length,
    characters: docs.reduce((sum, doc) => sum + doc.charCount, 0),
    dim: chunks[0]?.embedding.length ?? data.dim ?? status.dim,
    embedding: data.embeddingMode ?? status.mode,
    llm: process.env.DEEPSEEK_API_KEY?.trim() ? "deepseek" : "demo",
  };
}

export async function getLibrary(userId: string): Promise<{
  docs: KnowledgeDoc[];
  stats: LibraryStats;
  storage: "local" | "memory";
}> {
  const data = await getStore();
  const docs = visibleDocs(data, userId);
  return {
    docs: sortDocs(docs),
    stats: computeStats(data, userId),
    storage: storageMode,
  };
}

export async function getInternalChunks(
  userId: string
): Promise<StoredChunk[]> {
  const data = await getStore();
  return data.chunks.filter((chunk) => canAccess(chunk.ownerId, userId));
}

export async function addKnowledgeDocument(input: {
  ownerId: string;
  name: string;
  fileType: KnowledgeFileType;
  size: number;
  pages: number;
  rawText: string;
}): Promise<{ doc: KnowledgeDoc; stats: LibraryStats }> {
  const content = cleanExtractedText(input.rawText, input.fileType);
  const drafts = chunkText(content, input.pages);
  if (drafts.length === 0) {
    throw new Error("文档清洗后没有可用文本，无法构建知识库切片");
  }

  const { vectors, mode, dim } = await embedTexts(
    drafts.map((draft) => draft.content),
    "document"
  );
  const docId = `doc_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const doc: KnowledgeDoc = {
    id: docId,
    ownerId: input.ownerId,
    name: input.name,
    fileType: input.fileType,
    size: input.size,
    pages: input.pages,
    uploadedAt: new Date().toISOString(),
    status: "ready",
    chunkCount: drafts.length,
    charCount: content.length,
    isDemo: false,
  };
  const chunks: StoredChunk[] = drafts.map((draft, i) => ({
    id: `${docId}_c${draft.index}`,
    ownerId: input.ownerId,
    docId,
    docName: input.name,
    fileType: input.fileType,
    page: draft.page,
    index: draft.index,
    content: draft.content,
    embedding: vectors[i] ?? [],
  }));

  return exclusive(async () => {
    const data = await getStore();
    data.docs.push(doc);
    data.chunks.push(...chunks);
    data.initialized = true;
    data.embeddingMode = mode;
    data.dim = dim;
    await persist(data);
    return { doc, stats: computeStats(data, input.ownerId) };
  });
}

export async function deleteKnowledgeDocument(
  id: string,
  userId: string
): Promise<boolean> {
  return exclusive(async () => {
    const data = await getStore();
    const target = data.docs.find((doc) => doc.id === id);
    if (!target || target.ownerId !== userId) return false;
    data.docs = data.docs.filter((doc) => doc.id !== id);
    data.chunks = data.chunks.filter((chunk) => chunk.docId !== id);
    await persist(data);
    return true;
  });
}

export async function clearKnowledgeLibrary(userId: string): Promise<void> {
  await exclusive(async () => {
    const data = await getStore();
    const removed = new Set(
      data.docs.filter((doc) => doc.ownerId === userId).map((doc) => doc.id)
    );
    data.docs = data.docs.filter((doc) => doc.ownerId !== userId);
    data.chunks = data.chunks.filter((chunk) => !removed.has(chunk.docId));
    data.initialized = true;
    await persist(data);
  });
}

export async function getDocumentChunks(
  id: string,
  userId: string
): Promise<ChunkPreview[]> {
  const data = await getStore();
  const doc = data.docs.find(
    (item) => item.id === id && canAccess(item.ownerId, userId)
  );
  if (!doc) return [];
  return data.chunks
    .filter((chunk) => chunk.docId === id)
    .sort((a, b) => a.index - b.index)
    .slice(0, 60)
    .map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      page: chunk.page,
      content: chunk.content,
      chars: chunk.content.length,
    }));
}

export async function seedDemoLibrary(): Promise<number> {
  return exclusive(async () => {
    const data = await getStore();
    const existing = new Set(
      data.docs
        .filter((doc) => doc.ownerId === PUBLIC_OWNER)
        .map((doc) => doc.name)
    );
    const missing = buildDemoDocs().filter((doc) => !existing.has(doc.name));
    if (missing.length === 0) return 0;

    const prepared = await prepareDocuments(
      missing,
      PUBLIC_OWNER,
      data.docs.length
    );
    for (const item of prepared) {
      data.docs.push(item.doc);
      data.chunks.push(...item.chunks);
    }
    data.initialized = true;
    const status = getEmbeddingStatus();
    data.embeddingMode = status.mode;
    data.dim = data.chunks[0]?.embedding.length ?? status.dim;
    await persist(data);
    return prepared.length;
  });
}

export function getDocumentBaseName(name: string) {
  return stripDocumentExt(name);
}
