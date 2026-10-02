/**
 * AI-assisted re-check of a product's plans against its official pricing page.
 *
 * The model is only ever given (a) the text of the provider's official page and
 * (b) the product's existing plan/feature schema. It must return values that are
 * explicitly stated on the page, each with a short quote as evidence, or null.
 * Nothing it returns is applied automatically: differences become pending
 * `plan_changes` for a human to approve (approving applies them). When every
 * value matches, the product is marked as re-verified.
 *
 * Works with any Messages-API-compatible endpoint; only `fetch` is used.
 */
import type { FeatureDef, FeatureValue, PlanDef, ProductDef } from "@/lib/engine/types";

export const DEFAULT_AI_MODEL = "claude-haiku-4-5-20251001";
const MAX_PAGE_CHARS = 60_000;

export interface ExtractedPlan {
  /** slug of the matching catalog plan, or null if the page shows a plan we don't have */
  planSlug: string | null;
  /** plan name as written on the page */
  nameOnPage: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  /** feature key -> value stated on the page (null if not stated) */
  features: Record<string, FeatureValue>;
  /** feature key or "monthlyPrice"/"annualPrice" -> short verbatim quote from the page */
  evidence: Record<string, string>;
  /** plan is described as no longer available to new customers */
  discontinued?: boolean;
}

export interface Extraction {
  plans: ExtractedPlan[];
  /** catalog plan slugs that the page does not mention at all */
  missingPlans: string[];
  /** anything the model wants a human to know (bundle changes, regional notes) */
  notes: string;
  /** "high" | "medium" | "low" – how clearly the page states plan details */
  confidence: "high" | "medium" | "low";
}

export interface ProposedChange {
  kind: "ai_price" | "ai_feature" | "ai_new_plan" | "ai_plan_missing" | "ai_discontinued";
  planSlug: string | null;
  field: string | null; // "price:monthly" | "price:annual" | "feature:<key>"
  oldValue: string | null;
  newValue: string | null;
  evidence: string;
}

/* ---------------- Prompt ---------------- */

export function buildPrompt(product: ProductDef, pageText: string): { system: string; user: string } {
  const featureLines = product.features
    .filter((f) => f.type !== "info")
    .map((f) => {
      const shape =
        f.type === "boolean"
          ? "true/false"
          : f.type === "number"
            ? "number (use 999 for unlimited)"
            : `one of ${JSON.stringify(f.levels ?? [])}${f.levelLabels ? ` meaning ${JSON.stringify(f.levelLabels)}` : ""}`;
      return `- "${f.key}" (${f.label}): ${shape}`;
    })
    .join("\n");
  const planLines = product.plans.map((p) => `- slug "${p.slug}": "${p.name}" (${p.status})`).join("\n");

  const system = `You extract subscription plan facts from a provider's OFFICIAL web page for a consumer comparison tool.
Rules, in priority order:
1. Only report values that are explicitly stated on the page text you are given. Never use prior knowledge. If the page does not state a value, return null for it.
2. Every non-null value must be accompanied by a short verbatim quote (max 160 characters) from the page in "evidence".
3. Prices are US dollars, before tax, standard (non-promotional) rates. If only an introductory/promo price is shown, return null and mention it in "notes". Monthly price = price per month when billed monthly; annual price = total per year when billed yearly.
4. Match page plans to catalog plan slugs by name/meaning. If a plan on the page matches no catalog plan, set "planSlug": null and give "nameOnPage".
5. If the page says a catalog plan is no longer offered / not available to new members, set "discontinued": true for it.
6. Respond with ONLY a JSON object, no prose, matching exactly:
{"plans":[{"planSlug":string|null,"nameOnPage":string,"monthlyPrice":number|null,"annualPrice":number|null,"features":{<featureKey>:value|null},"evidence":{<featureKey|"monthlyPrice"|"annualPrice">:string},"discontinued":boolean}],"missingPlans":[string],"notes":string,"confidence":"high"|"medium"|"low"}`;

  const user = `PRODUCT: ${product.name} by ${product.companyName}

CATALOG PLANS (match these slugs):
${planLines}

FEATURES TO EXTRACT PER PLAN (use these exact keys):
${featureLines}

OFFICIAL PAGE TEXT (truncated to ${MAX_PAGE_CHARS} characters):
"""
${pageText.slice(0, MAX_PAGE_CHARS)}
"""`;
  return { system, user };
}

/* ---------------- Model call ---------------- */

export interface ModelCaller {
  (system: string, user: string): Promise<string>;
}

/** Default caller: Anthropic Messages API via fetch. */
export function anthropicCaller(apiKey: string, model = process.env.AI_MODEL || DEFAULT_AI_MODEL): ModelCaller {
  return async (system, user) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 4000, temperature: 0, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`AI API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (data.content ?? []).map((c) => (c.type === "text" ? c.text ?? "" : "")).join("");
  };
}

export function parseExtraction(text: string): Extraction {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("AI response contained no JSON");
  const raw = JSON.parse(text.slice(start, end + 1)) as Partial<Extraction>;
  const plans = Array.isArray(raw.plans) ? raw.plans : [];
  return {
    plans: plans.map((p) => ({
      planSlug: typeof p.planSlug === "string" ? p.planSlug : null,
      nameOnPage: String(p.nameOnPage ?? ""),
      monthlyPrice: numOrNull(p.monthlyPrice),
      annualPrice: numOrNull(p.annualPrice),
      features: typeof p.features === "object" && p.features ? p.features : {},
      evidence: typeof p.evidence === "object" && p.evidence ? p.evidence : {},
      discontinued: Boolean(p.discontinued),
    })),
    missingPlans: Array.isArray(raw.missingPlans) ? raw.missingPlans.map(String) : [],
    notes: String(raw.notes ?? ""),
    confidence: raw.confidence === "high" || raw.confidence === "low" ? raw.confidence : "medium",
  };
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/* ---------------- Diff (pure, unit-tested) ---------------- */

function normalize(f: FeatureDef | undefined, v: FeatureValue): FeatureValue {
  if (v === null || v === undefined || !f) return null;
  if (f.type === "boolean") return typeof v === "string" ? v.toLowerCase() === "true" : Boolean(v);
  if (f.type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (f.type === "ordinal") return f.levels?.includes(String(v)) ? String(v) : null;
  return v;
}

/**
 * Compare what the page states with what the catalog has. Only differences
 * where the page explicitly states a value become proposals; a page that is
 * silent about something never overrides the catalog.
 */
export function diffExtraction(product: ProductDef, extraction: Extraction): ProposedChange[] {
  const out: ProposedChange[] = [];
  const featureByKey = new Map(product.features.map((f) => [f.key, f]));

  for (const ex of extraction.plans) {
    if (!ex.planSlug) {
      out.push({ kind: "ai_new_plan", planSlug: null, field: null, oldValue: null, newValue: ex.nameOnPage, evidence: summarizeNewPlan(ex) });
      continue;
    }
    const plan = product.plans.find((p) => p.slug === ex.planSlug);
    if (!plan) continue;

    if (ex.discontinued && plan.status === "active") {
      out.push({ kind: "ai_discontinued", planSlug: plan.slug, field: "status", oldValue: "active", newValue: "grandfathered", evidence: ex.evidence.discontinued ?? ex.evidence.nameOnPage ?? "Page states the plan is no longer available to new customers." });
    }

    for (const [period, stated] of [
      ["monthly", ex.monthlyPrice],
      ["annual", ex.annualPrice],
    ] as const) {
      if (stated === null) continue;
      const current = plan.prices.find((p) => p.period === period)?.amount ?? null;
      if (current === null || Math.abs(current - stated) > 0.005) {
        out.push({
          kind: "ai_price",
          planSlug: plan.slug,
          field: `price:${period}`,
          oldValue: current === null ? null : String(current),
          newValue: String(stated),
          evidence: ex.evidence[`${period}Price`] ?? "",
        });
      }
    }

    for (const [key, rawValue] of Object.entries(ex.features)) {
      const f = featureByKey.get(key);
      if (!f || f.type === "info") continue;
      const stated = normalize(f, rawValue);
      if (stated === null) continue;
      const current = normalize(f, plan.features[key] ?? null);
      if (JSON.stringify(current) !== JSON.stringify(stated)) {
        out.push({
          kind: "ai_feature",
          planSlug: plan.slug,
          field: `feature:${key}`,
          oldValue: current === null ? null : JSON.stringify(current),
          newValue: JSON.stringify(stated),
          evidence: ex.evidence[key] ?? "",
        });
      }
    }
  }

  for (const slug of extraction.missingPlans) {
    const plan = product.plans.find((p) => p.slug === slug && p.status === "active");
    if (plan) out.push({ kind: "ai_plan_missing", planSlug: slug, field: null, oldValue: plan.name, newValue: null, evidence: "The official page no longer mentions this plan." });
  }
  return out;
}

function summarizeNewPlan(ex: ExtractedPlan): string {
  const bits = [ex.monthlyPrice !== null ? `$${ex.monthlyPrice}/mo` : null, ex.annualPrice !== null ? `$${ex.annualPrice}/yr` : null].filter(Boolean);
  const feats = Object.entries(ex.features)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .slice(0, 8);
  return `Plan "${ex.nameOnPage}" appears on the page but is not in the catalog. ${bits.join(", ")}${feats.length ? `; ${feats.join(", ")}` : ""}`.trim();
}

/** How many catalog values the extraction positively confirmed (used to decide auto re-verification). */
export function countConfirmed(product: ProductDef, extraction: Extraction): { confirmed: number; total: number } {
  let confirmed = 0;
  let total = 0;
  const featureByKey = new Map(product.features.map((f) => [f.key, f]));
  for (const plan of product.plans.filter((p) => p.status === "active")) {
    const ex = extraction.plans.find((x) => x.planSlug === plan.slug);
    const monthly = plan.prices.find((p) => p.period === "monthly")?.amount ?? null;
    if (monthly !== null) {
      total++;
      if (ex && ex.monthlyPrice !== null && Math.abs(ex.monthlyPrice - monthly) < 0.005) confirmed++;
    }
    for (const [key, v] of Object.entries(plan.features)) {
      const f = featureByKey.get(key);
      if (!f || f.type === "info" || v === null) continue;
      total++;
      const stated = ex ? normalize(f, ex.features[key] ?? null) : null;
      if (stated !== null && JSON.stringify(stated) === JSON.stringify(normalize(f, v))) confirmed++;
    }
  }
  return { confirmed, total };
}

/** Full pipeline for one product: page text -> proposals + confirmation stats. */
export async function recheckWithAI(product: ProductDef, pageText: string, call: ModelCaller): Promise<{ extraction: Extraction; changes: ProposedChange[]; confirmed: number; total: number }> {
  const { system, user } = buildPrompt(product, pageText);
  const raw = await call(system, user);
  const extraction = parseExtraction(raw);
  const changes = diffExtraction(product, extraction);
  const { confirmed, total } = countConfirmed(product, extraction);
  return { extraction, changes, confirmed, total };
}

export type { PlanDef };
