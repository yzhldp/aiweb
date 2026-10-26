import { NextResponse } from "next/server";
import { MAX_UPLOAD_MB } from "@/lib/constants";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { resolveModelForUser } from "@/lib/server/model";
import { getLibrary } from "@/lib/server/store";
import type { StatusResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const { stats, storage } = await getLibrary(user.id);
    const model = await resolveModelForUser(user.id);
    const configured = model.source !== "none";
    const payload: StatusResponse = {
      ok: true,
      ...stats,
      llm: configured ? "deepseek" : "demo",
      modelLabel: model.label,
      personalModel: model.source === "personal",
      storage,
      maxUploadMb: MAX_UPLOAD_MB,
    };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[learnmate] status error", error);
    return NextResponse.json(
      { ok: false, error: "无法读取知识库状态" },
      { status: 500 }
    );
  }
}
