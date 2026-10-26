import { NextResponse, type NextRequest } from "next/server";
import { createUser } from "@/lib/server/accounts";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/auth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RegisterBody {
  name?: string;
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`register:${ip}`, 8, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (
    typeof body.name !== "string" ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json({ error: "请填写完整的注册信息" }, { status: 400 });
  }

  try {
    const user = await createUser({
      name: body.name,
      email: body.email,
      password: body.password,
    });
    const token = await createSessionToken(user.id);
    const response = NextResponse.json(
      { ok: true, user },
      { headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "注册失败，请稍后重试",
      },
      { status: 400 }
    );
  }
}
