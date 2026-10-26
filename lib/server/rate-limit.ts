interface Bucket {
  count: number;
  resetAt: number;
}

const globalStore = globalThis as typeof globalThis & {
  __learnmateRateLimit?: Map<string, Bucket>;
};

const buckets: Map<string, Bucket> =
  globalStore.__learnmateRateLimit ??
  (globalStore.__learnmateRateLimit = new Map<string, Bucket>());

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "anonymous";
  return request.headers.get("x-real-ip") ?? "anonymous";
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  bucket.count++;
  return { ok: true, retryAfter: 0, remaining: limit - bucket.count };
}

export function rateLimitResponse(retryAfter: number) {
  return new Response(
    JSON.stringify({
      error: `请求过于频繁，请 ${retryAfter} 秒后再试`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Retry-After": String(retryAfter),
      },
    }
  );
}

export function friendlyError(error: unknown, fallback = "服务暂时不可用，请稍后重试") {
  if (!(error instanceof Error)) return fallback;
  const message = error.message || fallback;
  if (/fetch failed|ECONNREFUSED|ETIMEDOUT|abort|network/i.test(message)) {
    return "无法连接到 AI 服务，请检查网络或 API 配置后重试";
  }
  if (/401|unauthorized|invalid api key/i.test(message)) {
    return "API Key 无效或已过期，请检查环境变量配置";
  }
  if (/429|rate limit|quota/i.test(message)) {
    return "AI 服务请求额度已用尽或触发限流，请稍后重试";
  }
  return message;
}
