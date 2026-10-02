import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductDef } from "@/lib/catalog";
import { analyze } from "@/lib/engine";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { logEvent } from "@/lib/events";
import { recordAnonymousAnswers } from "@/lib/answers";
import { assertSameOrigin, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  product: z.string().min(1).max(80),
  currentPlan: z.string().max(80).nullable(),
  userPrice: z.number().min(0).max(10_000).nullable().optional(),
  userPeriod: z.enum(["monthly", "annual", "weekly", "one-time"]).optional(),
  answers: z.record(z.string().max(60), z.union([z.number(), z.string().max(60), z.boolean(), z.null()])).default({}),
});

export async function POST(req: Request) {
  try {
    await assertSameOrigin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const limiter = rateLimit(await clientKey("analyze"), 60, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "You're going a little fast. Please wait a moment and try again." }, { status: 429 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "We couldn't read your answers. Please go back and try again." }, { status: 400 });
  }

  const product = await getProductDef(body.product);
  if (!product) return NextResponse.json({ error: "We couldn't find that subscription. Please check the name and try again." }, { status: 404 });

  // Only accept answers for features that exist and plans that exist – ignore anything else.
  const featureKeys = new Set(product.features.map((f) => f.key));
  const answers: typeof body.answers = {};
  for (const [k, v] of Object.entries(body.answers)) if (featureKeys.has(k)) answers[k] = v;
  const currentPlanSlug = body.currentPlan && product.plans.some((p) => p.slug === body.currentPlan) ? body.currentPlan : null;

  const result = analyze({ product, currentPlanSlug, userPrice: body.userPrice ?? null, userPeriod: body.userPeriod, answers });
  void logEvent("recommendation_generated", { product: product.slug, status: result.status, count: result.questionsAsked });
  void recordAnonymousAnswers(product, currentPlanSlug, answers, result);
  return NextResponse.json({ result });
}
