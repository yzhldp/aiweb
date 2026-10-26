import {
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  MIN_CHUNK_CHARS,
} from "@/lib/constants";

export interface ChunkDraft {
  index: number;
  content: string;
  offset: number;
  page: number;
}

const HEADING_PATTERN =
  /^(第[一二三四五六七八九十百千0-9]+[章节讲部分篇]|[0-9]+(\.[0-9]+){0,3}[\s、.]|[一二三四五六七八九十]+[、.]|[（(][一二三四五六七八九十0-9]+[）)]|附录|参考文献|Chapter|CHAPTER)/;

const SENTENCE_END = /[。！？；：.!?;:]$/;
const PAGE_NUMBER = /^[-—–\s]*\d{1,4}[-—–\s]*$/;

function isWideChar(char: string) {
  return /[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char);
}

/**
 * PDF 文本清洗：
 * 1. 去除控制字符、零宽字符、替换符与孤立页码；
 * 2. 智能合并 PDF 强制换行，避免把中文句子切碎；
 * 3. 保留标题与自然段结构，供后续重叠切片使用。
 */
export function cleanPdfText(raw: string): string {
  if (!raw) return "";

  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "")
    .replace(/\ufffd/g, "")
    .replace(/[ \t\u3000]+/g, " ")
    .replace(/[ ]+\n/g, "\n")
    .replace(/\n[ ]+/g, "\n");

  const lines = text.split("\n");
  const normalizedLines: string[] = [];
  let previousWasBlank = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (normalizedLines.length > 0) previousWasBlank = true;
      continue;
    }
    if (PAGE_NUMBER.test(line)) continue;

    const isHeading = HEADING_PATTERN.test(line);
    if (normalizedLines.length === 0) {
      normalizedLines.push(line);
      previousWasBlank = false;
      continue;
    }

    const previous = normalizedLines[normalizedLines.length - 1];
    if (previousWasBlank || HEADING_PATTERN.test(previous)) {
      normalizedLines.push(`\n${line}`);
    } else if (isHeading || SENTENCE_END.test(previous)) {
      normalizedLines.push(`\n${line}`);
    } else {
      const lastChar = previous.slice(-1);
      const separator =
        isWideChar(lastChar) || isWideChar(line[0] ?? "")
          ? ""
          : lastChar === "-"
            ? ""
            : " ";
      normalizedLines[normalizedLines.length - 1] = previous + separator + line;
    }
    previousWasBlank = false;
  }

  return normalizedLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[，,]{2,}/g, "，")
    .replace(/[。.]{3,}/g, "。")
    .trim();
}

function estimatePage(offset: number, total: number, pages: number) {
  if (!Number.isFinite(pages) || pages <= 0 || total <= 0) return 1;
  return Math.min(pages, Math.max(1, Math.floor((offset / total) * pages) + 1));
}

function findBoundary(text: string, from: number, to: number): number {
  const slice = text.slice(from, to);
  const candidates = ["。", "！", "？", "；", "\n", "!", "?", ";", "."];
  let best = -1;
  for (const mark of candidates) {
    const idx = slice.lastIndexOf(mark);
    if (idx > best) best = idx;
  }
  return best >= 0 ? from + best + 1 : to;
}

/**
 * 固定长度 + 语义边界 + 重叠切片。
 * 优先在句号 / 换行处断开，并从上一片段尾部重叠，避免知识点被截断。
 */
export function chunkText(
  content: string,
  pages = 1,
  size = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP
): ChunkDraft[] {
  const text = content.trim();
  if (!text) return [];

  const chunks: ChunkDraft[] = [];
  const total = text.length;
  let start = 0;
  let index = 0;
  let guard = 0;

  while (start < total && guard < 5000) {
    guard++;
    let end = Math.min(start + size, total);
    if (end < total) {
      end = findBoundary(text, start + Math.floor(size * 0.6), end);
    }
    const piece = text.slice(start, end).trim();
    if (piece.length >= MIN_CHUNK_CHARS || (chunks.length === 0 && piece.length > 0)) {
      chunks.push({
        index,
        content: piece,
        offset: start,
        page: estimatePage(start, total, pages),
      });
      index++;
    }
    if (end >= total) break;

    const nextStart = Math.max(end - overlap, start + 1);
    start = nextStart;
  }

  return chunks;
}

function stripControlCharacters(raw: string) {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "")
    .replace(/\ufffd/g, "");
}

function compactCjkSpaces(text: string) {
  return text.replace(
    /([\u3400-\u9fff])[ \t\u3000]+(?=[\u3400-\u9fff])/g,
    "$1"
  );
}

/**
 * 纯文本 / Markdown / HTML / Word 文本清洗：
 * 保留段落与缩进，仅规范化行尾空白和多余空行，避免破坏代码块。
 */
export function cleanPlainText(raw: string): string {
  if (!raw) return "";
  return stripControlCharacters(raw)
    .replace(/[ \t\u3000]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanExtractedText(
  raw: string,
  fileType: "pdf" | "docx" | "markdown" | "text" | "html" | "image"
): string {
  if (fileType === "pdf") return cleanPdfText(raw);
  if (fileType === "image") return cleanPdfText(compactCjkSpaces(raw));
  return cleanPlainText(raw);
}

export function stripDocumentExt(name: string) {
  return name.replace(
    /\.(pdf|docx|markdown|md|html?|txt|png|jpe?g|bmp)$/i,
    ""
  );
}
