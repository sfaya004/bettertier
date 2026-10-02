import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runMonitor } from "@/lib/monitor/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled price check. Call from a cron job (GitHub Actions, cron-job.org,
 * your host's scheduler) with:  Authorization: Bearer $CRON_SECRET
 * Optional query: ?limit=15 to check a slice per run, ?product=netflix for one,
 * ?ai=1 to force the AI re-check now / ?ai=0 to skip it (default: per AI_RECHECK_DAYS schedule).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || secret.length < 16 || provided.length !== secret.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "") || undefined;
  const product = url.searchParams.get("product") ?? undefined;
  const aiParam = url.searchParams.get("ai");
  const report = await runMonitor({ limit, productSlug: product, ai: aiParam === "1" ? true : aiParam === "0" ? false : undefined });
  return NextResponse.json(report);
}
