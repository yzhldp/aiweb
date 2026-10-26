import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getSessionSecret, getUserById } from "@/lib/server/accounts";
import type { PublicUser } from "@/lib/types";

export const SESSION_COOKIE = "learnmate_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

interface SessionPayload {
  sub: string;
  exp: number;
}

// 无状态会话：只存用户 ID 与过期时间，用 HMAC 防止篡改，服务端无需维护 session 表。
function sign(payload: string, secret: Buffer) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function createSessionToken(userId: string) {
  const payload: SessionPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const secret = await getSessionSecret();
  return `${encoded}.${sign(encoded, secret)}`;
}

async function readToken(token: string): Promise<SessionPayload | null> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const secret = await getSessionSecret();
  const expected = sign(encoded, secret);
  // 先比较长度，避免 timingSafeEqual 在长度不一致时抛错，也避免泄露签名长度。
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!crypto.timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!payload?.sub || !payload.exp) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// HttpOnly 阻止脚本读取 Cookie；SameSite=Lax 兼顾站内跳转，生产环境强制 Secure。
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      process.env.VERCEL === "1" || process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function getSessionUser(): Promise<PublicUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await readToken(token);
  if (!payload) return null;
  return getUserById(payload.sub);
}

export async function requireUser() {
  return getSessionUser();
}

export function unauthorized() {
  return Response.json({ error: "登录状态已失效，请重新登录" }, { status: 401 });
}
