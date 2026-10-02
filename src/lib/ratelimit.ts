import "server-only";
import { headers } from "next/headers";

/**
 * Small in-memory sliding-window rate limiter.
 * Good for a single server instance (the MVP deployment). For multiple
 * instances, swap the store for Redis/Upstash – the interface stays the same.
 */
const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [k, times] of buckets) {
      const fresh = times.filter((t) => now - t < windowMs);
      if (fresh.length === 0) buckets.delete(k);
      else buckets.set(k, fresh);
    }
    lastSweep = now;
  }
  const times = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - times[0])) / 1000);
    buckets.set(key, times);
    return { ok: false, remaining: 0, retryAfterSeconds: retryAfter };
  }
  times.push(now);
  buckets.set(key, times);
  return { ok: true, remaining: limit - times.length, retryAfterSeconds: 0 };
}

/** Best-effort client identifier. Never stored – only used for the limiter key. */
export async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}
