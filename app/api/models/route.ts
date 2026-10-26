import { NextResponse, type NextRequest } from "next/server";
import {
  getUserModelInfo,
  getUserRuntimeModel,
  removeUserModel,
  saveUserModel,
} from "@/lib/server/accounts";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import {
  parseModelInput,
  resolveModelForUser,
  testModelConnection,
} from "@/lib/server/model";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const [personal, resolved] = await Promise.all([
      getUserModelInfo(user.id),
      resolveModelForUser(user.id),
    ]);
    return NextResponse.json(
      {
        personal,
        effective: {
          source: resolved.source,
          label: resolved.label,
          modelName: resolved.modelName,
          baseURL: resolved.config?.baseURL ?? null,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[learnmate] model config read error", error);
    return NextResponse.json({ error: "模型配置读取失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const ip = getClientIp(request);
  const limit = checkRateLimit(`model-save:${ip}`, 20, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  try {
    const input = parseModelInput(body);
    const personal = await saveUserModel(user.id, input);
    return NextResponse.json(
      {
        ok: true,
        personal,
        effective: {
          source: "personal",
          label: personal.label,
          modelName: personal.model,
          baseURL: personal.baseURL,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const ip = getClientIp(request);
  const limit = checkRateLimit(`model-delete:${ip}`, 20, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  try {
    const removed = await removeUserModel(user.id);
    const resolved = await resolveModelForUser(user.id);
    return NextResponse.json({
      ok: true,
      removed,
      effective: {
        source: resolved.source,
        label: resolved.label,
        modelName: resolved.modelName,
      },
    });
  } catch (error) {
    console.error("[learnmate] model delete error", error);
    return NextResponse.json({ error: "删除模型配置失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const ip = getClientIp(request);
  const limit = checkRateLimit(`model-test:${ip}`, 12, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  try {
    const input = parseModelInput(body);
    let apiKey = input.apiKey;
    if (!apiKey) {
      const saved = await getUserRuntimeModel(user.id);
      if (saved?.baseURL === input.baseURL) apiKey = saved.apiKey;
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: "测试连接需要填写 API Key" },
        { status: 400 }
      );
    }

    const result = await testModelConnection({
      baseURL: input.baseURL,
      model: input.model,
      apiKey,
    });
    return NextResponse.json(
      {
        ok: true,
        message: "连接成功",
        models: result.models,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "连接测试失败",
      },
      { status: 400 }
    );
  }
}
