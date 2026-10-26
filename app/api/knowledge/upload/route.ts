import { NextResponse, type NextRequest } from "next/server";
import { MAX_UPLOAD_MB } from "@/lib/constants";
import {
  detectFileType,
  FILE_TYPE_META,
  SUPPORTED_FORMAT_HINT,
} from "@/lib/file-types";
import { cleanExtractedText } from "@/lib/rag/chunk";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import {
  DocumentExtractionError,
  extractDocument,
} from "@/lib/server/extract";
import {
  checkRateLimit,
  getClientIp,
  friendlyError,
  rateLimitResponse,
} from "@/lib/server/rate-limit";
import { addKnowledgeDocument, getLibrary } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function safeFileName(original: string) {
  const extension = original.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? "";
  const base = original
    .slice(0, original.length - extension.length)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return `${base || "document"}${extension}`;
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const ip = getClientIp(request);
  const limit = checkRateLimit(`upload:${ip}`, 10, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return fail("上传请求格式错误，请重新选择文件");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail("未接收到文件，请选择一个课程资料文件");
    }

    const safeName = safeFileName(file.name);
    const fileType = detectFileType(safeName);

    if (!fileType) {
      if (/\.doc$/i.test(safeName)) {
        return fail(
          "暂不支持旧版 .doc，请在 Word 中另存为 .docx 后上传",
          415
        );
      }
      return fail(`仅支持 ${SUPPORTED_FORMAT_HINT}`, 415);
    }

    if (file.size === 0) {
      return fail("文件内容为空，请重新选择");
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return fail(`文件超过 ${MAX_UPLOAD_MB}MB 上限，请压缩后重试`, 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let extracted: Awaited<ReturnType<typeof extractDocument>>;
    try {
      extracted = await extractDocument(buffer, safeName);
    } catch (error) {
      if (error instanceof DocumentExtractionError) {
        return fail(error.message, error.status);
      }
      throw error;
    }

    const cleaned = cleanExtractedText(extracted.text, extracted.fileType);
    if (cleaned.length < 30) {
      return fail(
        extracted.fileType === "image"
          ? "未从图片中识别到有效文字，请更换更清晰、文字更完整的图片"
          : "未从文件中提取到有效文字，请确认文档包含可复制的文本内容",
        422
      );
    }

    const { doc, stats } = await addKnowledgeDocument({
      ownerId: user.id,
      name: safeName,
      fileType: extracted.fileType,
      size: file.size,
      pages: extracted.pages,
      rawText: extracted.text,
    });
    const { storage } = await getLibrary(user.id);

    const typeLabel = FILE_TYPE_META[extracted.fileType].label;
    const message =
      extracted.fileType === "image"
        ? `图片 OCR 识别完成，已生成 ${doc.chunkCount} 个知识片段`
        : `已完成${typeLabel}解析、清洗、切片与向量化，共生成 ${doc.chunkCount} 个知识片段`;

    return NextResponse.json({
      ok: true,
      doc,
      stats,
      storage,
      pages: extracted.pages,
      fileType: extracted.fileType,
      message,
    });
  } catch (error) {
    console.error("[learnmate] upload error", error);
    return NextResponse.json(
      { error: friendlyError(error, "文档处理失败，请稍后重试") },
      { status: 500 }
    );
  }
}
