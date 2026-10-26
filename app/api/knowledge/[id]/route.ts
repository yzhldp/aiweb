import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/server/rate-limit";
import {
  deleteKnowledgeDocument,
  getDocumentChunks,
  getLibrary,
} from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    const { docs } = await getLibrary(user.id);
    const doc = docs.find((item) => item.id === params.id);
    if (!doc) {
      return NextResponse.json({ error: "文档不存在或已被删除" }, { status: 404 });
    }
    const chunks = await getDocumentChunks(params.id, user.id);
    return NextResponse.json(
      { doc, chunks },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[learnmate] chunk preview error", error);
    return NextResponse.json({ error: "片段读取失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const ip = getClientIp(request);
  const limit = checkRateLimit(`delete:${ip}`, 20, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  try {
    const removed = await deleteKnowledgeDocument(params.id, user.id);
    if (!removed) {
      return NextResponse.json(
        { error: "文档不存在、属于其他用户或为公共只读文档" },
        { status: 404 }
      );
    }
    const { docs, stats, storage } = await getLibrary(user.id);
    return NextResponse.json({ ok: true, docs, stats, storage });
  } catch (error) {
    console.error("[learnmate] delete document error", error);
    return NextResponse.json({ error: "删除文档失败" }, { status: 500 });
  }
}
