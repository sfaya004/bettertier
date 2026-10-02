import type {
  AnalysisInput,
  AnalysisResult,
  FeatureDef,
  FitStatus,
  PlanDef,
  PlanEvaluation,
  RequirementCheck,
} from "./types";
import { compareValue, isMore } from "./compare";
import { annualEquivalent, formatMoney, formatNeed, formatValue, listToSentence, monthlyEquivalent, round2, toMonthly } from "./format";
import { shoppablePlans } from "./questions";

/** Data older than this is shown with a "please double-check" warning. */
export const STALE_AFTER_DAYS = 120;

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

function checkPlan(product: { features: FeatureDef[] }, plan: PlanDef, answers: AnalysisInput["answers"]): RequirementCheck[] {
  const checks: RequirementCheck[] = [];
  for (const f of product.features) {
    if (!(f.key in answers)) continue;
    const need = answers[f.key];
    const have = plan.features[f.key] ?? null;
    const state = compareValue(f, have, need);
    const provided = formatValue(f, have);
    const needed = formatNeed(f, need);
    let text: string;
    switch (state) {
      case "met":
        if (f.type === "boolean") text = need === false ? `${f.label}: you said you don't need this` : `${f.label}: included`;
        else text = `${f.label}: you said "${needed}" – this plan gives you ${provided}`;
        break;
      case "unused":
        text = `${f.label}: included, though you said you don't need it`;
        break;
      case "not_met":
        text = f.type === "boolean" ? `${f.label}: not included, but you said you need it` : `${f.label}: you said "${needed}", but this plan only gives you ${provided}`;
        break;
      default:
        text =
          need === null || need === undefined
            ? `${f.label}: you weren't sure, so we couldn't check this`
            : `${f.label}: we couldn't verify what this plan includes`;
    }
    checks.push({ featureKey: f.key, featureLabel: f.label, state, text, needed, provided });
  }
  return checks;
}

function evaluate(
  input: AnalysisInput,
  plan: PlanDef,
  current: PlanDef | null,
): PlanEvaluation {
  const { product, answers } = input;
  const checks = checkPlan(product, plan, answers);
  const monthlyCost = monthlyEquivalent(plan);
  const gainedVsCurrent: string[] = [];
  const lostVsCurrent: string[] = [];
  if (current && current.slug !== plan.slug) {
    for (const f of product.features) {
      if (f.type === "info") continue;
      const a = plan.features[f.key] ?? null;
      const b = current.features[f.key] ?? null;
      if (isMore(f, a, b)) gainedVsCurrent.push(describeDelta(f, a));
      else if (isMore(f, b, a)) lostVsCurrent.push(describeDelta(f, b, a));
    }
  }
  return {
    plan,
    monthlyCost,
    annualCost: annualEquivalent(plan),
    priceKnown: monthlyCost !== null,
    satisfiesAll: checks.every((c) => c.state !== "not_met"),
    checks,
    unknownCount: checks.filter((c) => c.state === "unknown").length,
    gainedVsCurrent,
    lostVsCurrent,
    missing: checks.filter((c) => c.state === "not_met").map((c) => c.featureLabel),
    isCurrent: current?.slug === plan.slug,
    isRecommended: false,
  };
}

/** "4K Ultra HD picture quality" / "2 more people can watch at the same time" */
function describeDelta(f: FeatureDef, better: PlanDef["features"][string], worse?: PlanDef["features"][string]): string {
  if (f.type === "boolean") return f.label;
  if (f.type === "number" && worse !== undefined && worse !== null) {
    return `${f.label} (${formatValue(f, worse)} instead of ${formatValue(f, better)})`;
  }
  return `${f.label}: ${formatValue(f, better)}`;
}

export function analyze(input: AnalysisInput): AnalysisResult {
  const { product, currentPlanSlug, answers } = input;
  const today = input.today ?? new Date();
  const plans = shoppablePlans(product, currentPlanSlug);
  const current = currentPlanSlug ? product.plans.find((p) => p.slug === currentPlanSlug) ?? null : null;

  const evaluations = plans.map((p) => evaluate(input, p, current));
  const evalBySlug = new Map(evaluations.map((e) => [e.plan.slug, e]));
  const currentEval = current ? evalBySlug.get(current.slug) ?? evaluate(input, current, current) : null;

  // Cost the user actually pays for the current plan.
  let usedUserPrice = false;
  let currentMonthlyCost: number | null = currentEval?.monthlyCost ?? null;
  const caveats: string[] = [];
  if (input.userPrice !== undefined && input.userPrice !== null && input.userPrice > 0) {
    const userMonthly = toMonthly(input.userPrice, input.userPeriod ?? "monthly");
    if (currentMonthlyCost !== null && Math.abs(userMonthly - currentMonthlyCost) > 0.5) {
      caveats.push(
        `You told us you pay about ${formatMoney(userMonthly)} per month. The published price for ${current?.name ?? "that plan"} is ${formatMoney(currentMonthlyCost)} per month. We used the amount you entered for your savings estimate. Prices can differ because of taxes, promotions, older pricing, or add-ons.`,
      );
    }
    currentMonthlyCost = userMonthly;
    usedUserPrice = true;
  }

  // Candidates: plans that satisfy every known requirement and have a known price.
  const candidates = evaluations.filter((e) => e.satisfiesAll && e.priceKnown && e.plan.status === "active");
  candidates.sort((a, b) => {
    const diff = (a.monthlyCost ?? 0) - (b.monthlyCost ?? 0);
    if (Math.abs(diff) > 0.005) return diff;
    // tie: prefer staying on the current plan, then the lower tier
    if (a.isCurrent) return -1;
    if (b.isCurrent) return 1;
    return a.plan.tier - b.plan.tier;
  });
  const recommended = candidates[0] ?? null;
  if (recommended) recommended.isRecommended = true;

  const questionsAsked = Object.keys(answers).length;
  const unsureKeys = Object.entries(answers)
    .filter(([, v]) => v === null)
    .map(([k]) => k);

  // Data freshness
  const verifiedAt = product.lastVerifiedAt ?? null;
  const dataIsStale = verifiedAt ? daysBetween(new Date(verifiedAt), today) > STALE_AFTER_DAYS : true;
  if (dataIsStale) {
    caveats.push(
      verifiedAt
        ? `We last verified ${product.name} prices on ${new Date(verifiedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}. Please double-check current prices on the provider's website before changing anything.`
        : `We have not yet verified ${product.name} prices against the provider's website. Please double-check before changing anything.`,
    );
  }
  if (current && current.confidence === "uncertain") {
    caveats.push(`Some details of the ${current.name} plan could not be verified from the provider's official pages.`);
  }
  if (current && current.status === "grandfathered") {
    caveats.push(`The ${current.name} plan is no longer sold to new customers. If you leave it, you may not be able to get it back.`);
  }

  const reasons: string[] = [];
  const uncertainties: string[] = [];
  let status: FitStatus;
  let headline: string;
  let summary: string;
  let featuresLost: string[] = [];
  let featuresGained: string[] = [];
  let monthlyDifference: number | null = null;

  // Which unsure answers actually matter? Only those where current and recommended differ.
  const mattersUnsure = (a: PlanDef | null, b: PlanDef | null) =>
    unsureKeys.filter((k) => {
      const f = product.features.find((x) => x.key === k);
      if (!f) return false;
      const va = a?.features[k] ?? null;
      const vb = b?.features[k] ?? null;
      return JSON.stringify(va) !== JSON.stringify(vb);
    });

  if (plans.length <= 1) {
    status = current ? "good_fit" : "needs_review";
    headline = `${product.name} only has one plan`;
    summary = `There is no cheaper or more complete ${product.name} plan to switch to. The only choice is how you pay for it.`;
    reasons.push(`${product.name} currently offers a single plan for everyone.`);
  } else if (!current) {
    // "I'm not sure which plan I have"
    status = "needs_review";
    if (recommended) {
      headline = `The ${recommended.plan.name} plan looks like the right fit for you`;
      summary = `Based on your answers, the ${recommended.plan.name} plan (${formatMoney(recommended.monthlyCost)} per month) covers what you need. Find out which plan you have now, then come back and compare.`;
      reasons.push(`The ${recommended.plan.name} plan covers everything you told us you need.`);
      for (const c of recommended.checks.filter((c) => c.state === "met")) reasons.push(c.text);
    } else {
      headline = `We need a little more information`;
      summary = `We couldn't find a ${product.name} plan that clearly matches your answers. Check the plan details on the provider's website.`;
    }
    if (product.planHelp) uncertainties.push(`How to find your plan: ${product.planHelp}`);
  } else if (!currentEval || !currentEval.satisfiesAll) {
    // UNDER-SUBSCRIBED
    status = "under_subscribed";
    const missing = currentEval?.missing ?? [];
    headline = `Your current plan may be missing something you need`;
    summary = recommended
      ? `You said you need ${listToSentence(missing)}, but the ${current.name} plan doesn't include ${missing.length > 1 ? "them" : "it"}. The ${recommended.plan.name} plan does.`
      : `You said you need ${listToSentence(missing)}, but the ${current.name} plan doesn't include ${missing.length > 1 ? "them" : "it"}. We couldn't find a plan with a verified price that covers everything.`;
    for (const c of currentEval?.checks.filter((c) => c.state === "not_met") ?? []) reasons.push(c.text);
    if (recommended) {
      featuresGained = recommended.gainedVsCurrent;
      featuresLost = recommended.lostVsCurrent;
      if (currentMonthlyCost !== null && recommended.monthlyCost !== null) {
        monthlyDifference = round2(currentMonthlyCost - recommended.monthlyCost);
      }
    }
    uncertainties.push(...mattersUnsure(current, recommended?.plan ?? null).map((k) => unsureText(product.features, k)));
  } else if (recommended && currentMonthlyCost !== null && recommended.monthlyCost !== null && recommended.plan.slug !== current.slug && recommended.monthlyCost < currentMonthlyCost - 0.005) {
    // OVER-SUBSCRIBED (a cheaper plan covers everything)
    const unsure = mattersUnsure(current, recommended.plan);
    monthlyDifference = round2(currentMonthlyCost - recommended.monthlyCost);
    featuresLost = recommended.lostVsCurrent;
    featuresGained = recommended.gainedVsCurrent;
    if (unsure.length > 0) {
      status = "needs_review";
      headline = `You might be able to save, but we need one more answer`;
      summary = `The ${recommended.plan.name} plan is ${formatMoney(monthlyDifference)} a month cheaper, but it differs from your plan on something you weren't sure about. Check the point below before you switch.`;
      uncertainties.push(...unsure.map((k) => unsureText(product.features, k)));
    } else {
      status = "over_subscribed";
      headline = `You may be paying for more than you need`;
      summary = `Based on your answers, the ${recommended.plan.name} plan covers everything you use, for about ${formatMoney(monthlyDifference)} less each month.`;
    }
    reasons.push(`The ${recommended.plan.name} plan covers everything you told us you need:`);
    for (const c of recommended.checks.filter((c) => c.state === "met" || c.state === "unused")) reasons.push(c.text);
  } else {
    // GOOD FIT
    status = "good_fit";
    headline = `Your current plan looks like a good fit`;
    const cheaper = evaluations.filter((e) => e.plan.slug !== current.slug && e.monthlyCost !== null && currentMonthlyCost !== null && e.monthlyCost < currentMonthlyCost);
    if (cheaper.length === 0) {
      summary = `You're on the least expensive ${product.name} plan that covers what you need.`;
    } else {
      summary = `Every cheaper ${product.name} plan is missing something you told us you need, so switching would cost you a feature you use.`;
      for (const e of cheaper) {
        if (e.missing.length > 0) reasons.push(`${e.plan.name} (${formatMoney(e.monthlyCost)}/month) doesn't include ${listToSentence(e.missing)}.`);
        else if (e.unknownCount > 0 && !e.priceKnown) reasons.push(`${e.plan.name}: we couldn't verify its price.`);
        else if (e.unknownCount > 0) reasons.push(`${e.plan.name}: we couldn't confirm it includes everything you need.`);
      }
    }
    const unsure = mattersUnsure(current, cheaper[0]?.plan ?? null);
    if (unsure.length > 0 && cheaper.some((e) => e.satisfiesAll)) {
      status = "needs_review";
      headline = `Your plan probably fits, but one answer could change that`;
      uncertainties.push(...unsure.map((k) => unsureText(product.features, k)));
    }
    if (currentEval) for (const c of currentEval.checks.filter((c) => c.state === "met")) reasons.push(c.text);
    monthlyDifference = 0;
  }

  // If we could not price the comparison at all, be honest about it.
  if (current && (currentMonthlyCost === null || (recommended && recommended.monthlyCost === null))) {
    status = "unable_to_verify";
    headline = `We couldn't verify the price of your plan`;
    summary = `We know what the ${current.name} plan includes, but we couldn't confirm its current price from the provider's official pages, so we can't estimate savings. Check the price on the provider's website.`;
  }

  // Billing tip: paying yearly is cheaper for the plan you'd end up on.
  const target = recommended?.plan ?? current;
  if (target) {
    const monthly = target.prices.find((p) => p.period === "monthly" && p.amount !== null)?.amount ?? null;
    const annual = target.prices.find((p) => p.period === "annual" && p.amount !== null)?.amount ?? null;
    if (monthly !== null && annual !== null && annual < monthly * 12 - 1) {
      caveats.push(
        `Tip: paying for ${target.name} yearly (${formatMoney(annual)}) instead of monthly (${formatMoney(monthly * 12)} over a year) would save about ${formatMoney(round2(monthly * 12 - annual))} a year, if you're sure you'll keep it all year.`,
      );
    }
  }

  const annualDifference = monthlyDifference === null ? null : round2(monthlyDifference * 12);
  const allPlans = [...evaluations].sort((a, b) => a.plan.tier - b.plan.tier || (a.monthlyCost ?? 0) - (b.monthlyCost ?? 0));

  return {
    status,
    headline,
    summary,
    currentPlan: currentEval,
    recommendedPlan: recommended,
    monthlyDifference,
    annualDifference,
    currentMonthlyCost,
    recommendedMonthlyCost: recommended?.monthlyCost ?? null,
    reasons: dedupe(reasons),
    uncertainties: dedupe(uncertainties),
    featuresLost,
    featuresGained,
    allPlans,
    caveats,
    dataVerifiedAt: verifiedAt,
    dataIsStale,
    pricingUrl: product.pricingUrl ?? null,
    usedUserPrice,
    questionsAsked,
  };
}

function unsureText(features: FeatureDef[], key: string): string {
  const f = features.find((x) => x.key === key);
  return f ? `You weren't sure about "${f.label.toLowerCase()}". ${f.help ?? ""}`.trim() : key;
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}

export const STATUS_LABELS: Record<FitStatus, { label: string; symbol: string; tone: "good" | "warn" | "info" }> = {
  good_fit: { label: "Good fit", symbol: "✓", tone: "good" },
  over_subscribed: { label: "May be paying for more than you need", symbol: "$", tone: "warn" },
  under_subscribed: { label: "May be missing something you need", symbol: "!", tone: "warn" },
  needs_review: { label: "Needs a closer look", symbol: "?", tone: "info" },
  unable_to_verify: { label: "Couldn't verify", symbol: "?", tone: "info" },
};
