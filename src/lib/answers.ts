import { and, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AnalysisResult, Answers, ProductDef } from "@/lib/engine/types";

/**
 * Store one anonymous row per completed comparison.
 * Contains only: subscription, category, plan, monthly price the person typed (if any),
 * the answers, how many questions were asked, the outcome. No identifiers of any kind,
 * and the date is truncated to the calendar day.
 */
export async function recordAnonymousAnswers(product: ProductDef, currentPlanSlug: string | null, answers: Answers, result: AnalysisResult): Promise<void> {
  if (process.env.RECORD_ANONYMOUS_ANSWERS === "false") return;
  try {
    await db.insert(schema.answerRecords).values({
      productSlug: product.slug,
      category: product.category,
      currentPlanSlug,
      userMonthlyPrice: result.usedUserPrice ? result.currentMonthlyCost : null,
      answers: JSON.stringify(answers),
      questionsAsked: result.questionsAsked,
      status: result.status,
      recommendedPlanSlug: result.recommendedPlan?.plan.slug ?? null,
      monthlyDifference: result.monthlyDifference,
      recordedOn: new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    console.error("answer record failed", err);
  }
}

export interface AnswerRow {
  id: number;
  recordedOn: string;
  productSlug: string;
  category: string;
  currentPlanSlug: string | null;
  userMonthlyPrice: number | null;
  answers: string;
  questionsAsked: number;
  status: string;
  recommendedPlanSlug: string | null;
  monthlyDifference: number | null;
}

export async function listAnswerRecords(since?: string): Promise<AnswerRow[]> {
  return db.query.answerRecords.findMany({ where: since ? and(gte(schema.answerRecords.recordedOn, since)) : undefined, orderBy: schema.answerRecords.id });
}

export async function countAnswerRecords(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(schema.answerRecords);
  return row?.n ?? 0;
}

/** CSV with one column per fixed field plus a JSON "answers" column (feature keys vary by product). */
export function answersToCsv(rows: AnswerRow[]): string {
  const header = ["id", "recorded_on", "product", "category", "current_plan", "user_monthly_price", "questions_asked", "status", "recommended_plan", "monthly_difference", "answers_json"];
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) => [r.id, r.recordedOn, r.productSlug, r.category, r.currentPlanSlug, r.userMonthlyPrice, r.questionsAsked, r.status, r.recommendedPlanSlug, r.monthlyDifference, r.answers].map(esc).join(","));
  return [header.join(","), ...lines].join("\n") + "\n";
}

export function answersToJsonl(rows: AnswerRow[]): string {
  return rows.map((r) => JSON.stringify({ ...r, answers: JSON.parse(r.answers) })).join("\n") + "\n";
}
