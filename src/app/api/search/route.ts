import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/catalog";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limiter = rateLimit(await clientKey("search"), 120, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "Too many searches. Please wait a moment and try again." }, { status: 429 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 60);
  const results = await searchProducts(q, 8);
  if (q.trim().length >= 3 && results.length === 0) void logEvent("search_no_results", { query_length: q.trim().length });
  return NextResponse.json({ results: results.map((r) => ({ slug: r.slug, name: r.name, categoryLabel: r.categoryLabel, planCount: r.planCount })) });
}
