import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SavedAnalysis } from "@/lib/store";

/** Saved analyses for a signed-in user, in the same shape the browser uses. */
export async function loadUserSubscriptions(userId: number): Promise<SavedAnalysis[]> {
  const rows = await db
    .select({
      id: schema.userSubscriptions.id,
      product: schema.products.slug,
      productName: schema.products.name,
      planSlug: schema.plans.slug,
      planName: schema.plans.name,
      userPrice: schema.userSubscriptions.userPrice,
      period: schema.userSubscriptions.period,
      answers: schema.userSubscriptions.answers,
      result: schema.userSubscriptions.result,
      updatedAt: schema.userSubscriptions.updatedAt,
    })
    .from(schema.userSubscriptions)
    .innerJoin(schema.products, eq(schema.products.id, schema.userSubscriptions.productId))
    .leftJoin(schema.plans, eq(schema.plans.id, schema.userSubscriptions.planId))
    .where(eq(schema.userSubscriptions.userId, userId))
    .orderBy(desc(schema.userSubscriptions.updatedAt));

  return rows.map((r) => {
    const result = safeParse<Partial<SavedAnalysis>>(r.result) ?? {};
    return {
      id: `acct-${r.id}`,
      product: r.product,
      productName: r.productName,
      currentPlan: r.planSlug ?? null,
      currentPlanName: r.planName ?? "Not sure",
      userPrice: r.userPrice,
      userPeriod: (r.period as SavedAnalysis["userPeriod"]) ?? "monthly",
      answers: safeParse(r.answers) ?? {},
      status: result.status ?? "needs_review",
      headline: result.headline ?? "",
      currentMonthlyCost: result.currentMonthlyCost ?? null,
      recommendedPlan: result.recommendedPlan ?? null,
      recommendedPlanName: result.recommendedPlanName ?? null,
      recommendedMonthlyCost: result.recommendedMonthlyCost ?? null,
      monthlyDifference: result.monthlyDifference ?? null,
      annualDifference: result.annualDifference ?? null,
      savedAt: r.updatedAt,
    };
  });
}

function safeParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
