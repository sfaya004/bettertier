import { NextResponse } from "next/server";
import { z } from "zod";
import { logEvent, ALLOWED_EVENTS } from "@/lib/events";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { assertSameOrigin, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().max(40), props: z.record(z.string().max(30), z.union([z.string().max(80), z.number(), z.boolean()])).optional() });

export async function POST(req: Request) {
  try {
    await assertSameOrigin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false }, { status: e.status });
    throw e;
  }
  const limiter = rateLimit(await clientKey("events"), 60, 60_000);
  if (!limiter.ok) return NextResponse.json({ ok: false }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !ALLOWED_EVENTS.has(parsed.data.name)) return NextResponse.json({ ok: false }, { status: 400 });
  await logEvent(parsed.data.name, parsed.data.props ?? {});
  return NextResponse.json({ ok: true });
}
