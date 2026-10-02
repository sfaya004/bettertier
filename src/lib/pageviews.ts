/**
 * Privacy-friendly page-view counting.
 *
 * - No cookies, no localStorage, nothing stored in the browser.
 * - The IP address is never written to the database. It is combined with the
 *   user agent and a secret salt that changes every day, hashed, and only the
 *   first 16 hex characters are kept. That lets us count "unique visitors today"
 *   but cannot be reversed or used to follow someone from one day to the next.
 * - /admin, /api and /account paths are never recorded, query strings are dropped,
 *   well-known bots are ignored, and a browser's "Do Not Track" / Global Privacy
 *   Control signal is honoured.
 * - Set RECORD_PAGE_VIEWS=false to switch it off entirely.
 */
import { createHash } from "node:crypto";
import { db, schema } from "@/db";

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|uptime|headless|lighthouse|pingdom|curl\/|wget\//i;
const SKIP_PREFIXES = ["/admin", "/api", "/account", "/_next"];

export function normalisePath(raw: string): string | null {
  let path = raw.trim();
  if (!path.startsWith("/")) return null;
  path = path.split("?")[0].split("#")[0];
  if (path.length > 120) return null;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (SKIP_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return null;
  if (!/^[\w\-./%]*$/.test(path)) return null;
  return path;
}

export function referrerHost(raw: string | null | undefined, ownHost: string | null): string | null {
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || (ownHost && host === ownHost.replace(/^www\./, "").toLowerCase())) return null;
    return host.slice(0, 80);
  } catch {
    return null;
  }
}

export function deviceType(userAgent: string): "phone" | "tablet" | "desktop" {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) return "tablet";
  if (/mobi|iphone|ipod|android|phone|blackberry|windows phone/.test(ua)) return "phone";
  return "desktop";
}

export function isBot(userAgent: string): boolean {
  return userAgent.length === 0 || BOT_RE.test(userAgent);
}

/** Salt that changes every UTC day; derived from a server secret so restarts don't change it mid-day. */
let fallbackSalt: string | null = null;
function dailySalt(day: string): string {
  const secret = process.env.ANALYTICS_SALT || process.env.CRON_SECRET || (fallbackSalt ??= createHash("sha256").update(String(Math.random()) + Date.now()).digest("hex"));
  return createHash("sha256").update(`${secret}:${day}`).digest("hex");
}

export function visitorHash(ip: string, userAgent: string, day: string): string {
  return createHash("sha256").update(`${dailySalt(day)}|${ip}|${userAgent}`).digest("hex").slice(0, 16);
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function recordPageView(input: { path: string; referrer?: string | null; ip: string; userAgent: string; ownHost: string | null; dnt: boolean }): Promise<boolean> {
  if (process.env.RECORD_PAGE_VIEWS === "false") return false;
  if (input.dnt) return false;
  if (isBot(input.userAgent)) return false;
  const path = normalisePath(input.path);
  if (!path) return false;
  const day = todayUtc();
  try {
    await db.insert(schema.pageViews).values({
      path,
      referrer: referrerHost(input.referrer, input.ownHost),
      device: deviceType(input.userAgent),
      visitor: visitorHash(input.ip, input.userAgent, day),
      day,
    });
    return true;
  } catch (err) {
    console.error("page view failed", err);
    return false;
  }
}
