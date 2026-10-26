import { NextResponse, type NextRequest } from "next/server";
import {
  checkRateLimit,
  getClientIp,
  friendlyError,
  rateLimitResponse,
} from "@/lib/server/rate-limit";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { clearKnowledgeLibrary, getLibrary } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    const { docs, stats, storage } = await getLibrary(user.id);
    return NextResponse.json(
      { docs, stats, storage },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[learnmate] library error", error);
    return NextResponse.json(
      { error: "知识库加载失败，请刷新重试" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const ip = getClientIp(request);
  const limit = checkRateLimit(`clear:${ip}`, 6, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  try {
    await clearKnowledgeLibrary(user.id);
    const { docs, stats, storage } = await getLibrary(user.id);
    return NextResponse.json({ ok: true, docs, stats, storage });
  } catch (error) {
    console.error("[learnmate] clear library error", error);
    return NextResponse.json(
      { error: friendlyError(error, "清空知识库失败") },
      { status: 500 }
    );
  }
}
