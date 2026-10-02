import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { assertSameOrigin, AuthError, getSessionUser } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { loadUserSubscriptions } from "@/lib/subscriptions";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
  product: z.string().max(80),
  currentPlan: z.string().max(80).nullable(),
  userPrice: z.number().min(0).max(10_000).nullable(),
  userPeriod: z.enum(["monthly", "annual", "weekly", "one-time"]),
  answers: z.record(z.string().max(60), z.union([z.number(), z.string().max(60), z.boolean(), z.null()])),
  status: z.string().max(30),
  headline: z.string().max(200),
  currentMonthlyCost: z.number().nullable(),
  recommendedPlan: z.string().max(80).nullable(),
  recommendedPlanName: z.string().max(120).nullable(),
  recommendedMonthlyCost: z.number().nullable(),
  monthlyDifference: z.number().nullable(),
  annualDifference: z.number().nullable(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json({ items: await loadUserSubscriptions(user.id) });
}

/** Save (replace) the user's list from the browser copy. */
export async function POST(req: Request) {
  try {
    await assertSameOrigin();
    const user = await getSessionUser();
    if (!user) throw new AuthError("Please sign in to save your subscriptions.", 401);
    const limiter = rateLimit(await clientKey("subs"), 30, 60_000);
    if (!limiter.ok) return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
    const body = z.object({ items: z.array(itemSchema).max(100) }).parse(await req.json());
    let saved = 0;
    for (const item of body.items) {
      const product = await db.query.products.findFirst({ where: eq(schema.products.slug, item.product) });
      if (!product) continue;
      const plan = item.currentPlan ? await db.query.plans.findFirst({ where: and(eq(schema.plans.productId, product.id), eq(schema.plans.slug, item.currentPlan)) }) : null;
      const values = {
        userId: user.id,
        productId: product.id,
        planId: plan?.id ?? null,
        userPrice: item.userPrice,
        period: item.userPeriod,
        answers: JSON.stringify(item.answers),
        result: JSON.stringify({
          status: item.status,
          headline: item.headline,
          currentMonthlyCost: item.currentMonthlyCost,
          recommendedPlan: item.recommendedPlan,
          recommendedPlanName: item.recommendedPlanName,
          recommendedMonthlyCost: item.recommendedMonthlyCost,
          monthlyDifference: item.monthlyDifference,
          annualDifference: item.annualDifference,
        }),
        updatedAt: new Date().toISOString(),
      };
      const existing = await db.query.userSubscriptions.findFirst({ where: and(eq(schema.userSubscriptions.userId, user.id), eq(schema.userSubscriptions.productId, product.id)) });
      if (existing) await db.update(schema.userSubscriptions).set(values).where(eq(schema.userSubscriptions.id, existing.id));
      else await db.insert(schema.userSubscriptions).values(values);
      saved++;
    }
    void logEvent("subscription_saved", { count: saved });
    return NextResponse.json({ ok: true, saved });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "We couldn't read that list." }, { status: 400 });
    throw e;
  }
}

export async function DELETE(req: Request) {
  try {
    await assertSameOrigin();
    const user = await getSessionUser();
    if (!user) throw new AuthError("Please sign in.", 401);
    const { id } = z.object({ id: z.number().int() }).parse(await req.json());
    await db.delete(schema.userSubscriptions).where(and(eq(schema.userSubscriptions.id, id), eq(schema.userSubscriptions.userId, user.id)));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
