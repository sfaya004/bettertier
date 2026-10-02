import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { recordPageView } from "@/lib/pageviews";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { assertSameOrigin, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ path: z.string().max(200), referrer: z.string().max(500).nullable().optional() });

/** Called once per page by the tiny beacon in the layout. Stores no cookies and no IP. */
export async function POST(req: Request) {
  try {
    await assertSameOrigin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false }, { status: e.status });
    throw e;
  }
  const limiter = rateLimit(await clientKey("pageview"), 120, 60_000);
  if (!limiter.ok) return NextResponse.json({ ok: false }, { status: 429 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const dnt = h.get("dnt") === "1" || h.get("sec-gpc") === "1";
  const ok = await recordPageView({
    path: parsed.data.path,
    referrer: parsed.data.referrer ?? h.get("referer"),
    ip,
    userAgent: h.get("user-agent") ?? "",
    ownHost: h.get("x-forwarded-host") ?? h.get("host"),
    dnt,
  });
  return NextResponse.json({ ok });
}
