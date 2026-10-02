import { and, asc, eq, inArray, like, or, sql } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/db";
import type { FeatureDef, PlanDef, ProductDef, BillingPeriod } from "@/lib/engine/types";
import { monthlyEquivalent } from "@/lib/engine/format";

export const DEFAULT_REGION = "US";

export const CATEGORY_LABELS: Record<string, string> = {
  "streaming-video": "TV & movie streaming",
  music: "Music & radio",
  "cloud-storage": "Cloud storage",
  productivity: "Office & productivity",
  "ai-tools": "AI assistants",
  gaming: "Video games",
  vpn: "VPN",
  security: "Security & antivirus",
  creative: "Design & creative",
  "password-manager": "Password managers",
  reading: "Books & audiobooks",
  learning: "Learning",
  fitness: "Fitness & wellness",
  news: "News",
  other: "Other memberships",
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

export interface ProductSummary {
  slug: string;
  name: string;
  companyName: string;
  category: string;
  categoryLabel: string;
  shortDescription: string | null;
  planCount: number;
  minMonthly: number | null;
  maxMonthly: number | null;
  lastVerifiedAt: string | null;
}

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/** Load a full product definition (features, plans, prices) for the engine and pages. */
export const getProductDef = cache(async function getProductDef(slug: string, opts?: { includeDraft?: boolean; region?: string }): Promise<ProductDef | null> {
  const region = opts?.region ?? DEFAULT_REGION;
  const product = await db.query.products.findFirst({ where: eq(schema.products.slug, slug) });
  if (!product) return null;
  const company = await db.query.companies.findFirst({ where: eq(schema.companies.id, product.companyId) });
  if (!company) return null;
  if (company.status !== "published" && !opts?.includeDraft) return null;

  const featureRows = await db.query.features.findMany({ where: eq(schema.features.productId, product.id), orderBy: asc(schema.features.sortOrder) });
  const planRows = await db.query.plans.findMany({ where: and(eq(schema.plans.productId, product.id)), orderBy: [asc(schema.plans.tier), asc(schema.plans.id)] });
  const planIds = planRows.map((p) => p.id);
  const pfRows = planIds.length ? await db.query.planFeatures.findMany({ where: inArray(schema.planFeatures.planId, planIds) }) : [];
  const priceRows = planIds.length ? await db.query.prices.findMany({ where: and(inArray(schema.prices.planId, planIds), eq(schema.prices.regionCode, region)) }) : [];

  const featureById = new Map(featureRows.map((f) => [f.id, f]));
  const features: FeatureDef[] = featureRows.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type as FeatureDef["type"],
    levels: parseJson<string[] | undefined>(f.levels, undefined),
    levelLabels: parseJson<Record<string, string> | undefined>(f.levelLabels, undefined),
    question: f.question ?? undefined,
    help: f.help ?? undefined,
    options: parseJson<FeatureDef["options"]>(f.options, undefined),
    sortOrder: f.sortOrder,
  }));

  const plans: PlanDef[] = planRows
    .filter((p) => p.status !== "retired")
    .map((p) => {
      const featureValues: Record<string, PlanDef["features"][string]> = {};
      for (const pf of pfRows.filter((x) => x.planId === p.id)) {
        const f = featureById.get(pf.featureId);
        if (f) featureValues[f.key] = parseJson<PlanDef["features"][string]>(pf.value, null);
      }
      return {
        slug: p.slug,
        name: p.name,
        tier: p.tier,
        status: p.status as PlanDef["status"],
        confidence: p.confidence as PlanDef["confidence"],
        seatsIncluded: p.seatsIncluded,
        bestFor: p.bestFor,
        notes: p.notes,
        prices: priceRows
          .filter((x) => x.planId === p.id)
          .map((x) => ({ period: x.period as BillingPeriod, amount: x.amount, currency: x.currency, isPromo: x.isPromo, notes: x.notes })),
        features: featureValues,
      };
    });

  return {
    slug: product.slug,
    name: product.name,
    companyName: company.name,
    category: company.category,
    pricingUrl: product.pricingUrl,
    affiliateUrl: company.affiliateHasProgram && company.affiliateUrl ? company.affiliateUrl : null,
    planHelp: product.planHelp,
    lastVerifiedAt: product.lastVerifiedAt,
    verificationStatus: product.verificationStatus,
    features,
    plans,
  };
});

export interface ProductExtras {
  faqs: { question: string; answer: string }[];
  sources: { url: string; title: string | null; checkedAt: string | null }[];
  website: string | null;
  shortDescription: string | null;
  affiliateHasProgram: boolean;
  affiliateUrl: string | null;
  notes: string | null;
}

export const getProductExtras = cache(async function getProductExtras(slug: string): Promise<ProductExtras | null> {
  const product = await db.query.products.findFirst({ where: eq(schema.products.slug, slug) });
  if (!product) return null;
  const company = await db.query.companies.findFirst({ where: eq(schema.companies.id, product.companyId) });
  const faqs = await db.query.faqs.findMany({ where: eq(schema.faqs.productId, product.id), orderBy: asc(schema.faqs.sortOrder) });
  const sources = await db.query.sources.findMany({ where: eq(schema.sources.productId, product.id) });
  return {
    faqs: faqs.map((f) => ({ question: f.question, answer: f.answer })),
    sources: sources.map((s) => ({ url: s.url, title: s.title, checkedAt: s.checkedAt })),
    website: company?.website ?? null,
    shortDescription: company?.shortDescription ?? null,
    affiliateHasProgram: company?.affiliateHasProgram ?? false,
    affiliateUrl: company?.affiliateUrl ?? null,
    notes: product.notes,
  };
});

/** All published products with price ranges, for the index page, search, and sitemap. */
export const listPublishedProducts = cache(async function listPublishedProducts(): Promise<ProductSummary[]> {
  try {
    return await listPublishedProductsInner();
  } catch (err) {
    // A missing/unmigrated database (e.g. during a first build) should not crash public pages.
    console.error("listPublishedProducts failed:", err instanceof Error ? err.message : err);
    return [];
  }
});

async function listPublishedProductsInner(): Promise<ProductSummary[]> {
  const rows = await db
    .select({
      slug: schema.products.slug,
      name: schema.products.name,
      companyName: schema.companies.name,
      category: schema.companies.category,
      shortDescription: schema.companies.shortDescription,
      lastVerifiedAt: schema.products.lastVerifiedAt,
      productId: schema.products.id,
    })
    .from(schema.products)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.products.companyId))
    .where(eq(schema.companies.status, "published"))
    .orderBy(asc(schema.products.name));

  const productIds = rows.map((r) => r.productId);
  const planRows = productIds.length
    ? await db.query.plans.findMany({ where: and(inArray(schema.plans.productId, productIds), eq(schema.plans.status, "active")) })
    : [];
  const planIds = planRows.map((p) => p.id);
  const priceRows = planIds.length ? await db.query.prices.findMany({ where: and(inArray(schema.prices.planId, planIds), eq(schema.prices.regionCode, DEFAULT_REGION)) }) : [];

  return rows.map((r) => {
    const plans = planRows.filter((p) => p.productId === r.productId);
    const monthlies = plans
      .map((p) =>
        monthlyEquivalent({
          slug: p.slug,
          name: p.name,
          tier: p.tier,
          status: "active",
          confidence: "verified",
          features: {},
          prices: priceRows.filter((x) => x.planId === p.id).map((x) => ({ period: x.period as BillingPeriod, amount: x.amount, currency: x.currency })),
        }),
      )
      .filter((m): m is number => m !== null);
    return {
      slug: r.slug,
      name: r.name,
      companyName: r.companyName,
      category: r.category,
      categoryLabel: CATEGORY_LABELS[r.category] ?? r.category,
      shortDescription: r.shortDescription,
      planCount: plans.length,
      minMonthly: monthlies.length ? Math.min(...monthlies) : null,
      maxMonthly: monthlies.length ? Math.max(...monthlies) : null,
      lastVerifiedAt: r.lastVerifiedAt,
    };
  });
}

/** Simple, forgiving search over product names and aliases. */
export async function searchProducts(query: string, limit = 8): Promise<ProductSummary[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = await listPublishedProducts();
  const aliasRows = await db.select({ slug: schema.companies.slug, aliases: schema.companies.aliases }).from(schema.companies).where(or(like(schema.companies.aliases, `%${q}%`), like(schema.companies.name, `%${q}%`)));
  const aliasHit = new Set(aliasRows.map((r) => r.slug));
  const scored = all
    .map((p) => {
      const name = p.name.toLowerCase();
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (aliasHit.has(p.slug)) score = 50;
      else if (q.split(/\s+/).every((w) => name.includes(w))) score = 40;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
  return scored.slice(0, limit).map((x) => x.p);
}

/** Popular picks shown before the user types anything. */
export const POPULAR_SLUGS = ["netflix", "spotify", "amazon-prime", "disney-plus", "chatgpt", "google-one", "microsoft-365", "xbox-game-pass", "hulu", "max", "icloud-plus", "youtube-premium"];

export async function getPopularProducts(): Promise<ProductSummary[]> {
  const all = await listPublishedProducts();
  const bySlug = new Map(all.map((p) => [p.slug, p]));
  return POPULAR_SLUGS.map((s) => bySlug.get(s)).filter((p): p is ProductSummary => Boolean(p));
}

export async function countPublished(): Promise<number> {
  try {
    const [row] = await db.select({ n: sql<number>`count(*)` }).from(schema.companies).where(eq(schema.companies.status, "published"));
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}
