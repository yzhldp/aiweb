import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/server/rate-limit";
import { getLibrary, seedDemoLibrary } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const ip = getClientIp(request);
  const limit = checkRateLimit(`seed:${ip}`, 8, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  try {
    const added = await seedDemoLibrary();
    const { docs, stats, storage } = await getLibrary(user.id);
    return NextResponse.json({ ok: true, added, docs, stats, storage });
  } catch (error) {
    console.error("[learnmate] seed error", error);
    return NextResponse.json(
      { error: "示例知识库载入失败，请稍后重试" },
      { status: 500 }
    );
  }
}
