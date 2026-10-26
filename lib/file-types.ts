import type { KnowledgeFileType } from "@/lib/types";

const EXTENSION_MAP: Record<string, KnowledgeFileType> = {
  pdf: "pdf",
  docx: "docx",
  md: "markdown",
  markdown: "markdown",
  txt: "text",
  html: "html",
  htm: "html",
  png: "image",
  jpg: "image",
  jpeg: "image",
  bmp: "image",
};

export const UPLOAD_ACCEPT =
  ".pdf,.docx,.md,.markdown,.txt,.html,.htm,.png,.jpg,.jpeg,.bmp";

export const SUPPORTED_FORMAT_HINT =
  "PDF、Word（.docx）、Markdown、TXT、HTML 与 PNG / JPG / BMP 图片";

export interface FileTypeMeta {
  label: string;
  short: string;
  paged: boolean;
  description: string;
}

export const FILE_TYPE_META: Record<KnowledgeFileType, FileTypeMeta> = {
  pdf: {
    label: "PDF 文档",
    short: "PDF",
    paged: true,
    description: "读取 PDF 文本层并清洗页码与乱码",
  },
  docx: {
    label: "Word 文档",
    short: "DOCX",
    paged: false,
    description: "提取 Word 段落、标题与正文文本",
  },
  markdown: {
    label: "Markdown",
    short: "MD",
    paged: false,
    description: "读取 Markdown 标题、正文与代码块",
  },
  text: {
    label: "纯文本",
    short: "TXT",
    paged: false,
    description: "读取 UTF-8 纯文本并按段落切片",
  },
  html: {
    label: "网页文本",
    short: "HTML",
    paged: false,
    description: "提取网页正文，剔除脚本与样式",
  },
  image: {
    label: "图片 OCR",
    short: "IMG",
    paged: false,
    description: "使用中英文 OCR 识别图片文字后入库",
  },
};

export function detectFileType(fileName: string): KnowledgeFileType | null {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return null;
  return EXTENSION_MAP[match[1]] ?? null;
}

export function inferFileType(
  fileName: string,
  fileType?: KnowledgeFileType
): KnowledgeFileType {
  return fileType ?? detectFileType(fileName) ?? "pdf";
}

export function isImageFile(fileName: string) {
  return inferFileType(fileName) === "image";
}

export function fileTypeMeta(
  fileName: string,
  fileType?: KnowledgeFileType
): FileTypeMeta {
  return FILE_TYPE_META[inferFileType(fileName, fileType)];
}

export function fileLocationLabel(
  fileName: string,
  fileType: KnowledgeFileType | undefined,
  page: number,
  chunkIndex: number
) {
  const meta = fileTypeMeta(fileName, fileType);
  const fragment = `片段 ${chunkIndex + 1}`;
  return meta.paged ? `第 ${page} 页 · ${fragment}` : `${meta.label} · ${fragment}`;
}
