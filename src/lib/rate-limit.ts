import type { NextRequest } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function ipFromForwardedHeaders(get: (name: string) => string | null) {
  const forwarded = get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export function getRequestIp(request: NextRequest): string {
  return ipFromForwardedHeaders((name) => request.headers.get(name));
}

export function getRequestIpFromRequest(req: Request): string {
  return ipFromForwardedHeaders((name) => req.headers.get(name));
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterMs: Math.max(0, bucket.resetAt - now) };
  }

  bucket.count += 1;
  return { ok: true };
}
