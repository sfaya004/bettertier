import type { FeatureDef, FeatureValue, PlanDef, BillingPeriod } from "./types";

export const UNLIMITED_SENTINEL = 999;

export function formatMoney(amount: number | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "Not available";
  const abs = Math.abs(amount);
  const str = abs.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${str}` : str;
}

export function periodLabel(period: BillingPeriod): string {
  switch (period) {
    case "monthly":
      return "per month";
    case "annual":
      return "per year";
    case "weekly":
      return "per week";
    case "one-time":
      return "one-time";
  }
}

export function formatGb(gb: number): string {
  if (gb >= 1000) {
    const tb = gb / 1000;
    return `${Number.isInteger(tb) ? tb : tb.toFixed(1)} TB`;
  }
  return `${gb} GB`;
}

/** Human-readable version of a plan's value for a feature. */
export function formatValue(feature: FeatureDef, value: FeatureValue): string {
  if (value === null || value === undefined) return "Not verified";
  switch (feature.type) {
    case "boolean":
      return value ? "Included" : "Not included";
    case "ordinal": {
      const label = feature.levelLabels?.[String(value)];
      return label ?? String(value);
    }
    case "number": {
      const n = Number(value);
      if (/_gb$/.test(feature.key)) return formatGb(n);
      if (n === UNLIMITED_SENTINEL) return "Unlimited";
      if (/_usd$/.test(feature.key)) return formatMoney(n);
      if (/percent|cashback/.test(feature.key)) return `${n}%`;
      return String(n);
    }
    default:
      return String(value);
  }
}

/** Human-readable version of what the user said they need. */
export function formatNeed(feature: FeatureDef, value: FeatureValue): string {
  if (value === null || value === undefined) return "Not sure";
  const opt = feature.options?.find((o) => o.value === value);
  if (opt) return opt.label;
  if (feature.type === "boolean") return value ? "Yes, I need this" : "No, I don't need this";
  return formatValue(feature, value);
}

/** Monthly-equivalent cost for a plan (monthly price preferred, else annual/12). */
export function monthlyEquivalent(plan: PlanDef): number | null {
  const monthly = plan.prices.find((p) => p.period === "monthly" && p.amount !== null);
  if (monthly && monthly.amount !== null) return round2(monthly.amount);
  const annual = plan.prices.find((p) => p.period === "annual" && p.amount !== null);
  if (annual && annual.amount !== null) return round2(annual.amount / 12);
  const weekly = plan.prices.find((p) => p.period === "weekly" && p.amount !== null);
  if (weekly && weekly.amount !== null) return round2((weekly.amount * 52) / 12);
  return null;
}

/** Yearly cost if billed the cheapest way the plan allows. */
export function annualEquivalent(plan: PlanDef): number | null {
  const annual = plan.prices.find((p) => p.period === "annual" && p.amount !== null);
  const monthly = plan.prices.find((p) => p.period === "monthly" && p.amount !== null);
  const candidates: number[] = [];
  if (annual && annual.amount !== null) candidates.push(annual.amount);
  if (monthly && monthly.amount !== null) candidates.push(monthly.amount * 12);
  if (candidates.length === 0) {
    const m = monthlyEquivalent(plan);
    return m === null ? null : round2(m * 12);
  }
  return round2(Math.min(...candidates));
}

export function toMonthly(amount: number, period: BillingPeriod): number {
  switch (period) {
    case "monthly":
      return round2(amount);
    case "annual":
      return round2(amount / 12);
    case "weekly":
      return round2((amount * 52) / 12);
    case "one-time":
      return round2(amount / 12);
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function listToSentence(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
