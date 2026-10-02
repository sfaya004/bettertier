import type { Answers, FeatureDef, FeatureValue, PlanDef, ProductDef } from "./types";
import { compareValue } from "./compare";

/** Maximum questions we will ever ask for one subscription. */
export const MAX_QUESTIONS = 8;

/** Plans a shopper can choose today (plus the user's own plan, if grandfathered). */
export function shoppablePlans(product: ProductDef, currentPlanSlug: string | null): PlanDef[] {
  return product.plans.filter(
    (p) => p.status === "active" || (currentPlanSlug !== null && p.slug === currentPlanSlug && p.status !== "retired"),
  );
}

/** Features that can be asked about and whose value differs between at least two shoppable plans. */
export function relevantFeatures(product: ProductDef, currentPlanSlug: string | null = null): FeatureDef[] {
  const plans = shoppablePlans(product, currentPlanSlug);
  return product.features
    .filter((f) => f.type !== "info" && f.question)
    .filter((f) => variesAcross(f, plans))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function variesAcross(feature: FeatureDef, plans: PlanDef[]): boolean {
  const values = new Set(plans.map((p) => JSON.stringify(p.features[feature.key] ?? null)));
  return values.size > 1;
}

/** Plans that satisfy every *known* answer so far (unknown answers never eliminate a plan). */
export function candidatePlans(product: ProductDef, answers: Answers, currentPlanSlug: string | null): PlanDef[] {
  const plans = shoppablePlans(product, currentPlanSlug);
  return plans.filter((plan) =>
    product.features.every((f) => {
      if (!(f.key in answers)) return true;
      const need = answers[f.key];
      const state = compareValue(f, plan.features[f.key] ?? null, need);
      return state !== "not_met";
    }),
  );
}

/**
 * Return the next question to ask, or null when every distinguishing feature
 * has been answered. We ask about EVERY feature that differs between the
 * provider's plans (not only the ones that would still change the outcome),
 * so the result is based on the full picture and can explain, feature by
 * feature, what the person would keep, gain or give up. Features that are
 * identical on every plan are never asked about.
 */
export function nextQuestion(product: ProductDef, answers: Answers, currentPlanSlug: string | null): FeatureDef | null {
  const asked = Object.keys(answers).length;
  if (asked >= MAX_QUESTIONS) return null;
  for (const f of relevantFeatures(product, currentPlanSlug)) {
    if (!(f.key in answers)) return f;
  }
  return null;
}

/** Total number of questions for this product (for "Question 2 of 5"). */
export function plannedQuestionCount(product: ProductDef, currentPlanSlug: string | null): number {
  return Math.min(MAX_QUESTIONS, relevantFeatures(product, currentPlanSlug).length);
}

/** Build answer options for a question, always ending with "I'm not sure". */
export function optionsFor(feature: FeatureDef): { label: string; value: FeatureValue }[] {
  const base: { label: string; value: FeatureValue }[] = [];
  if (feature.type === "boolean") {
    base.push({ label: "Yes, I use this", value: true }, { label: "No, I don't need this", value: false });
  } else if (feature.options && feature.options.length > 0) {
    for (const o of feature.options) base.push({ label: o.label, value: o.value });
  } else if (feature.type === "ordinal" && feature.levels) {
    for (const lvl of feature.levels) base.push({ label: feature.levelLabels?.[lvl] ?? lvl, value: lvl });
  }
  base.push({ label: "I'm not sure", value: null });
  return base;
}
