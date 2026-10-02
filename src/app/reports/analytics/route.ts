import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getOverview, type RangeDays } from "@/lib/analytics";
import { getSessionUser } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Machine-readable copy of the /admin/analytics dashboard, for scheduled reports.
 *
 *   GET /reports/analytics?days=30&key=<ANALYTICS_REPORT_KEY>
 *   (or send  Authorization: Bearer <ANALYTICS_REPORT_KEY>, or be signed in as an admin)
 *
 * The data is aggregate counts only – no personal information – so a leaked key can
 * reveal traffic numbers but nothing about any visitor. Disabled until the variable is set.
 */
export async function GET(req: Request) {
  const limiter = rateLimit(await clientKey("analytics-report"), 30, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "too many requests" }, { status: 429 });

  const url = new URL(req.url);
  const secret = process.env.ANALYTICS_REPORT_KEY ?? "";
  const header = req.headers.get("authorization") ?? "";
  const provided = url.searchParams.get("key") ?? (header.startsWith("Bearer ") ? header.slice(7) : "");
  const keyOk = secret.length >= 16 && provided.length === secret.length && timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
  const admin = keyOk ? null : await getSessionUser();
  if (!keyOk && admin?.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const requested = Number(url.searchParams.get("days") ?? 30);
  const days = ([7, 30, 90] as RangeDays[]).includes(requested as RangeDays) ? (requested as RangeDays) : 30;
  const overview = await getOverview(days);
  return NextResponse.json(
    { site: SITE_NAME, url: SITE_URL, generatedAt: new Date().toISOString(), dashboard: `${SITE_URL}/admin/analytics?range=${days}`, ...overview },
    { headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" } },
  );
}
