import { detectFileType, SUPPORTED_FORMAT_HINT } from "@/lib/file-types";
import type { KnowledgeFileType } from "@/lib/types";
import { recognizeImage } from "@/lib/server/ocr";
import { parsePdfBuffer } from "@/lib/server/pdf";

export class DocumentExtractionError extends Error {
  constructor(
    message: string,
    public status = 422
  ) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

export interface ExtractedDocument {
  text: string;
  pages: number;
  fileType: KnowledgeFileType;
}

function startsWith(buffer: Buffer, bytes: number[]) {
  return bytes.every((byte, index) => buffer[index] === byte);
}

// 扩展名可以伪造，解析前用文件头二次确认，避免把二进制文件当作文档处理。
function assertSignature(buffer: Buffer, fileType: KnowledgeFileType) {
  const valid =
    fileType === "pdf"
      ? buffer.subarray(0, 5).toString("latin1") === "%PDF-"
      : fileType === "docx"
        ? startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])
        : fileType === "image"
          ? startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
            startsWith(buffer, [0xff, 0xd8, 0xff]) ||
            buffer.subarray(0, 2).toString("latin1") === "BM"
          : true;

  if (!valid) {
    throw new DocumentExtractionError(
      "文件内容与扩展名不匹配，可能已损坏或被修改，请重新导出后上传",
      415
    );
  }
}

function decodeText(buffer: Buffer) {
  if (startsWith(buffer, [0xff, 0xfe])) {
    return buffer.subarray(2).toString("utf16le");
  }
  if (startsWith(buffer, [0xfe, 0xff])) {
    const swapped = Buffer.from(buffer.subarray(2));
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  const head = buffer.subarray(0, 4096);
  if (head.includes(0)) {
    throw new DocumentExtractionError(
      "文件不是有效的文本编码，请另存为 UTF-8 后重试",
      415
    );
  }
  const text = buffer.toString("utf8").replace(/^\ufeff/, "");
  if (text.includes("\ufffd")) {
    throw new DocumentExtractionError(
      "文本编码无法识别，请将文件另存为 UTF-8 后重试",
      415
    );
  }
  return text;
}

function decodeEntities(text: string) {
  return text.replace(
    /&(nbsp|amp|lt|gt|quot|#39|#x?[0-9a-f]+);/gi,
    (entity, code: string) => {
      const lower = code.toLowerCase();
      if (lower === "nbsp") return " ";
      if (lower === "amp") return "&";
      if (lower === "lt") return "<";
      if (lower === "gt") return ">";
      if (lower === "quot") return '"';
      if (lower === "#39") return "'";
      const numeric = lower.startsWith("#x")
        ? Number.parseInt(lower.slice(2), 16)
        : lower.startsWith("#")
          ? Number.parseInt(lower.slice(1), 10)
          : Number.NaN;
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
    }
  );
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function markdownToText(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "");
}

async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  } catch (error) {
    console.error("[learnmate] docx parse error", error);
    throw new DocumentExtractionError(
      "Word 文档解析失败，请确认文件未加密且为 .docx 格式",
      422
    );
  }
}

export async function extractDocument(
  buffer: Buffer,
  fileName: string
): Promise<ExtractedDocument> {
  const fileType = detectFileType(fileName);
  if (!fileType) {
    throw new DocumentExtractionError(
      `不支持该文件格式，当前支持 ${SUPPORTED_FORMAT_HINT}`,
      415
    );
  }

  assertSignature(buffer, fileType);

  if (fileType === "pdf") {
    try {
      const parsed = await parsePdfBuffer(buffer);
      return { text: parsed.text, pages: parsed.pages, fileType };
    } catch (error) {
      console.error("[learnmate] pdf parse error", error);
      throw new DocumentExtractionError(
        "PDF 解析失败，文件可能已加密、损坏或包含不受支持的字体",
        422
      );
    }
  }

  if (fileType === "docx") {
    const text = await extractDocx(buffer);
    return { text, pages: 1, fileType };
  }

  if (fileType === "image") {
    try {
      const text = await recognizeImage(buffer);
      return { text, pages: 1, fileType };
    } catch (error) {
      console.error("[learnmate] image ocr error", error);
      throw new DocumentExtractionError(
        "图片 OCR 识别失败，请尝试更清晰的 PNG / JPG 图片，或检查 OCR 语言数据是否可用",
        422
      );
    }
  }

  const raw = decodeText(buffer);
  const text =
    fileType === "html"
      ? htmlToText(raw)
      : fileType === "markdown"
        ? markdownToText(raw)
        : raw;
  return { text, pages: 1, fileType };
}
