
export const BOT_USER_AGENT = process.env.MONITOR_USER_AGENT ?? "BetterTierBot/1.0 (+https://bettertier.example/bot; price verification, once per day)";
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000;

export interface FetchResult {
  ok: boolean;
  status: number | null;
  text: string;
  error?: string;
  contentType?: string;
}

/** Fetch a public page politely: identified user agent, timeout, size cap, no cookies, no retries. */
/** Only public http(s) hosts may be fetched – never loopback, link-local or private ranges. */
export function isSafePublicUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
  if (!host.includes(".") && !host.includes(":")) return false;
  return true;
}

export async function fetchPage(url: string): Promise<FetchResult> {
  if (!isSafePublicUrl(url)) return { ok: false, status: null, text: "", error: "URL is not a public http(s) address" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": BOT_USER_AGENT, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok) return { ok: false, status: res.status, text: "", error: `HTTP ${res.status}`, contentType };
    const reader = res.body?.getReader();
    if (!reader) return { ok: false, status: res.status, text: "", error: "empty body", contentType };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
    return { ok: true, status: res.status, text, contentType };
  } catch (err) {
    const message = err instanceof Error ? (err.name === "AbortError" ? "timed out" : err.message) : String(err);
    return { ok: false, status: null, text: "", error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Minimal robots.txt check. We only look at the rules for our own user agent
 * and for "*". If robots.txt can't be fetched we assume crawling is allowed
 * (standard behaviour), but a 5xx is treated as "do not crawl" to be safe.
 */
export async function robotsAllows(url: string): Promise<{ allowed: boolean; reason: string }> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return { allowed: false, reason: "invalid URL" };
  }
  const robotsUrl = `${target.origin}/robots.txt`;
  const res = await fetchPage(robotsUrl);
  if (!res.ok) {
    if (res.status && res.status >= 500) return { allowed: false, reason: `robots.txt returned ${res.status}` };
    return { allowed: true, reason: "no robots.txt" };
  }
  const groups = parseRobots(res.text);
  const botName = BOT_USER_AGENT.split("/")[0].toLowerCase();
  const rules = groups.get(botName) ?? groups.get("*") ?? [];
  const path = target.pathname + target.search;
  // Longest matching rule wins (Google-style precedence).
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules) {
    if (r.path === "") continue;
    if (matchesRule(path, r.path) && (!best || r.path.length > best.len)) best = { allow: r.allow, len: r.path.length };
  }
  if (!best) return { allowed: true, reason: "no matching rule" };
  return { allowed: best.allow, reason: best.allow ? "allowed by robots.txt" : "disallowed by robots.txt" };
}

function parseRobots(text: string): Map<string, { allow: boolean; path: string }[]> {
  const groups = new Map<string, { allow: boolean; path: string }[]>();
  let currentAgents: string[] = [];
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!lastWasAgent) currentAgents = [];
      currentAgents.push(value.toLowerCase());
      for (const a of currentAgents) if (!groups.has(a)) groups.set(a, []);
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      for (const a of currentAgents) groups.get(a)!.push({ allow: key === "allow", path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function matchesRule(path: string, rule: string): boolean {
  // Support "*" wildcards and "$" end anchors.
  const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const anchored = escaped.endsWith("\\$") ? `^${escaped.slice(0, -2)}$` : `^${escaped}`;
  return new RegExp(anchored).test(path);
}

/**
 * Optional: render a page with a headless browser for sites that build their
 * pricing tables with JavaScript. Uses Playwright when it is installed
 * (`npx playwright install chromium`); returns an error otherwise so the caller
 * can fall back gracefully. Still respects robots.txt (checked by the caller),
 * identifies itself, and never signs in or interacts with the page.
 */
export async function renderPage(url: string): Promise<FetchResult> {
  if (!isSafePublicUrl(url)) return { ok: false, status: null, text: "", error: "URL is not a public http(s) address" };
  let pw: typeof import("playwright") | null = null;
  try {
    pw = await import("playwright");
  } catch {
    return { ok: false, status: null, text: "", error: "headless rendering unavailable (playwright not installed)" };
  }
  const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
  try {
    const context = await browser.newContext({ userAgent: BOT_USER_AGENT, javaScriptEnabled: true });
    const page = await context.newPage();
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT_MS * 2 });
    const status = res?.status() ?? null;
    if (status && status >= 400) return { ok: false, status, text: "", error: `HTTP ${status}` };
    const html = await page.content();
    return { ok: true, status, text: html.slice(0, MAX_BYTES), contentType: "text/html" };
  } catch (err) {
    return { ok: false, status: null, text: "", error: err instanceof Error ? err.message : String(err) };
  } finally {
    await browser.close();
  }
}
