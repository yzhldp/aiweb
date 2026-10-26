import { NextResponse, type NextRequest } from "next/server";
import { verifyCredentials } from "@/lib/server/accounts";
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

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`login:${ip}`, 12, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
  }

  try {
    const user = await verifyCredentials(body.email, body.password);
    if (!user) {
      return NextResponse.json(
        { error: "邮箱或密码不正确" },
        { status: 401 }
      );
    }
    const token = await createSessionToken(user.id);
    const response = NextResponse.json(
      { ok: true, user },
      { headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error("[learnmate] login error", error);
    return NextResponse.json({ error: "登录失败，请稍后重试" }, { status: 500 });
  }
}
