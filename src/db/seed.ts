/**
 * Seed the catalog from data/catalog/*.json.
 *
 *   npm run db:seed            -> inserts products that don't exist yet (safe to re-run)
 *   npm run db:seed -- --update -> also overwrites existing products' plans/features/prices
 *                                  (admin edits to those products will be replaced)
 *   npm run db:seed -- --text   -> refreshes only the WORDING of existing products (feature
 *                                  labels/questions/help/options, plan names and descriptions,
 *                                  FAQs, short descriptions). Prices, plan status, verification
 *                                  dates and price history are left untouched. The container
 *                                  entrypoint runs this on every deploy so copy edits in the
 *                                  catalog reach production without a re-seed.
 *
 * A product is published automatically when enough of its active plans have a
 * verified price; otherwise it is left as a draft for an admin to review.
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "./index";
import { z } from "zod";

const featureSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string(),
  type: z.enum(["number", "boolean", "ordinal", "info"]),
  levels: z.array(z.string()).optional(),
  levelLabels: z.record(z.string(), z.string()).optional(),
  question: z.string().optional(),
  help: z.string().optional(),
  options: z.array(z.object({ label: z.string(), value: z.union([z.number(), z.string(), z.boolean()]) })).optional(),
});

const planSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tier: z.number().int(),
  status: z.enum(["active", "grandfathered", "retired"]).default("active"),
  confidence: z.enum(["verified", "uncertain"]).default("verified"),
  prices: z.array(z.object({ period: z.enum(["monthly", "annual", "weekly", "one-time"]), amount: z.number().nullable(), notes: z.string().optional() })),
  features: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()])),
  seatsIncluded: z.number().int().optional(),
  bestFor: z.string().optional(),
  notes: z.string().optional(),
});

export const catalogFileSchema = z.object({
  company: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string(),
    category: z.string(),
    website: z.string().optional(),
    pricingUrl: z.string().optional(),
    shortDescription: z.string().optional(),
    affiliate: z.object({ hasProgram: z.boolean().nullable().optional(), url: z.string().nullable().optional(), notes: z.string().nullable().optional() }).optional(),
    planHelp: z.string().optional(),
    aliases: z.array(z.string()).optional(),
  }),
  region: z.string().default("US"),
  currency: z.string().default("USD"),
  checkedAt: z.string(),
  sources: z.array(z.object({ url: z.string(), title: z.string().optional(), checkedAt: z.string().optional() })).default([]),
  features: z.array(featureSchema),
  plans: z.array(planSchema).min(1),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  notes: z.string().optional(),
});
export type CatalogFile = z.infer<typeof catalogFileSchema>;

/** Extra search aliases that the research files don't carry. */
const ALIASES: Record<string, string[]> = {
  max: ["HBO", "HBO Max"],
  "amazon-prime": ["Prime Video", "Amazon"],
  "youtube-premium": ["YouTube", "YouTube Music"],
  "google-one": ["Google Drive", "Google Photos storage", "Google storage"],
  "google-ai": ["Gemini", "Google AI Pro", "Google AI Ultra", "Gemini Advanced"],
  "microsoft-365": ["Office 365", "Office", "Word", "Excel", "OneDrive"],
  "microsoft-copilot": ["Copilot", "Copilot Pro"],
  chatgpt: ["OpenAI", "ChatGPT Plus", "ChatGPT Pro"],
  claude: ["Anthropic", "Claude Pro", "Claude Max"],
  "xbox-game-pass": ["Game Pass", "Xbox"],
  "playstation-plus": ["PS Plus", "PlayStation", "PSN"],
  "nintendo-switch-online": ["Switch Online", "Nintendo"],
  "adobe-creative-cloud": ["Adobe", "Photoshop", "Lightroom", "Creative Cloud"],
  "icloud-plus": ["iCloud", "Apple storage"],
  "apple-tv-plus": ["Apple TV"],
  "apple-fitness-plus": ["Apple Fitness"],
  "apple-music": ["Apple Music"],
  "disney-plus": ["Disney", "Disney Plus"],
  "paramount-plus": ["Paramount", "Paramount Plus", "CBS"],
  "norton-360": ["Norton", "LifeLock"],
  mcafee: ["McAfee+"],
  nordvpn: ["Nord"],
  expressvpn: ["Express VPN"],
  "proton-vpn": ["Proton"],
  "1password": ["One Password"],
  "kindle-unlimited": ["Kindle"],
  "linkedin-premium": ["LinkedIn"],
  nytimes: ["New York Times", "NYT"],
  siriusxm: ["Sirius", "XM", "Sirius XM"],
  "costco-membership": ["Costco"],
  "peloton-app": ["Peloton"],
};

function jsonOrNull(v: unknown): string | null {
  return v === undefined ? null : JSON.stringify(v);
}

/** Decide whether a freshly-seeded product is ready for the public site. */
export function shouldPublish(file: CatalogFile): boolean {
  const active = file.plans.filter((p) => p.status === "active");
  const priced = active.filter((p) => p.prices.some((x) => x.amount !== null));
  if (active.length === 0) return false;
  if (active.length === 1) return priced.length === 1;
  return priced.length >= 2 && priced.length >= Math.ceil(active.length * 0.5);
}

/**
 * Update only the human-readable wording of an existing product from its catalog file.
 * Matches features by key and plans by slug; never touches prices, statuses or verification.
 */
export async function refreshCatalogText(file: CatalogFile): Promise<"updated" | "skipped"> {
  const c = file.company;
  const product = await db.query.products.findFirst({ where: eq(schema.products.slug, c.slug) });
  if (!product) return "skipped";
  const now = new Date().toISOString();

  await db
    .update(schema.companies)
    .set({ name: c.name, shortDescription: c.shortDescription ?? null, updatedAt: now })
    .where(eq(schema.companies.id, product.companyId));
  await db.update(schema.products).set({ name: c.name, planHelp: c.planHelp ?? null, updatedAt: now }).where(eq(schema.products.id, product.id));

  const features = await db.query.features.findMany({ where: eq(schema.features.productId, product.id) });
  for (const f of file.features) {
    const row = features.find((x) => x.key === f.key);
    if (!row) continue;
    await db
      .update(schema.features)
      .set({ label: f.label, question: f.question ?? null, help: f.help ?? null, options: jsonOrNull(f.options), levelLabels: jsonOrNull(f.levelLabels) })
      .where(eq(schema.features.id, row.id));
  }

  const plans = await db.query.plans.findMany({ where: eq(schema.plans.productId, product.id) });
  for (const p of file.plans) {
    const row = plans.find((x) => x.slug === p.slug);
    if (!row) continue;
    await db.update(schema.plans).set({ name: p.name, bestFor: p.bestFor ?? null, notes: p.notes ?? null }).where(eq(schema.plans.id, row.id));
  }

  await db.delete(schema.faqs).where(eq(schema.faqs.productId, product.id));
  let faqOrder = 0;
  for (const f of file.faq) {
    await db.insert(schema.faqs).values({ productId: product.id, question: f.q, answer: f.a, sortOrder: faqOrder++ });
  }
  return "updated";
}

export async function seedCatalogFile(file: CatalogFile, opts: { update: boolean; text?: boolean }): Promise<"inserted" | "updated" | "skipped"> {
  const c = file.company;
  await db.insert(schema.regions).values({ code: file.region, name: file.region === "US" ? "United States" : file.region, currency: file.currency }).onConflictDoNothing();

  const existingCompany = await db.query.companies.findFirst({ where: eq(schema.companies.slug, c.slug) });
  const existingProduct = await db.query.products.findFirst({ where: eq(schema.products.slug, c.slug) });
  if (existingProduct && !opts.update) return opts.text ? refreshCatalogText(file) : "skipped";

  const aliases = Array.from(new Set([...(c.aliases ?? []), ...(ALIASES[c.slug] ?? [])])).join(", ");
  const companyValues = {
    slug: c.slug,
    name: c.name,
    category: c.category,
    website: c.website ?? null,
    shortDescription: c.shortDescription ?? null,
    aliases: aliases || null,
    affiliateHasProgram: c.affiliate?.hasProgram ?? false,
    affiliateUrl: c.affiliate?.url ?? null,
    affiliateNotes: c.affiliate?.notes ?? null,
    updatedAt: new Date().toISOString(),
  };
  let companyId: number;
  if (existingCompany) {
    await db.update(schema.companies).set(companyValues).where(eq(schema.companies.id, existingCompany.id));
    companyId = existingCompany.id;
  } else {
    const [row] = await db.insert(schema.companies).values({ ...companyValues, status: shouldPublish(file) ? "published" : "draft" }).returning({ id: schema.companies.id });
    companyId = row.id;
  }

  const hasUncertain = file.plans.some((p) => p.confidence === "uncertain" && p.status === "active");
  const productValues = {
    companyId,
    slug: c.slug,
    name: c.name,
    pricingUrl: c.pricingUrl ?? null,
    planHelp: c.planHelp ?? null,
    notes: file.notes ?? null,
    lastVerifiedAt: file.checkedAt,
    lastCheckedAt: file.checkedAt,
    verificationStatus: hasUncertain ? "needs_review" : "verified",
    updatedAt: new Date().toISOString(),
  };
  let productId: number;
  if (existingProduct) {
    await db.update(schema.products).set(productValues).where(eq(schema.products.id, existingProduct.id));
    productId = existingProduct.id;
    // Replace child rows wholesale when updating (plan_features/prices cascade from plans).
    const oldPlans = await db.query.plans.findMany({ where: eq(schema.plans.productId, productId) });
    for (const p of oldPlans) await db.delete(schema.plans).where(eq(schema.plans.id, p.id));
    await db.delete(schema.features).where(eq(schema.features.productId, productId));
    await db.delete(schema.sources).where(eq(schema.sources.productId, productId));
    await db.delete(schema.faqs).where(eq(schema.faqs.productId, productId));
  } else {
    const [row] = await db.insert(schema.products).values(productValues).returning({ id: schema.products.id });
    productId = row.id;
  }

  const featureIds = new Map<string, number>();
  let order = 0;
  for (const f of file.features) {
    const [row] = await db
      .insert(schema.features)
      .values({
        productId,
        key: f.key,
        label: f.label,
        type: f.type,
        levels: jsonOrNull(f.levels),
        levelLabels: jsonOrNull(f.levelLabels),
        question: f.question ?? null,
        help: f.help ?? null,
        options: jsonOrNull(f.options),
        sortOrder: order++,
      })
      .returning({ id: schema.features.id });
    featureIds.set(f.key, row.id);
  }

  for (const p of file.plans) {
    const [planRow] = await db
      .insert(schema.plans)
      .values({
        productId,
        slug: p.slug,
        name: p.name,
        tier: p.tier,
        status: p.status,
        confidence: p.confidence,
        seatsIncluded: p.seatsIncluded ?? null,
        bestFor: p.bestFor ?? null,
        notes: p.notes ?? null,
      })
      .returning({ id: schema.plans.id });
    for (const [key, value] of Object.entries(p.features)) {
      const featureId = featureIds.get(key);
      if (!featureId) throw new Error(`${c.slug}: plan ${p.slug} references unknown feature "${key}"`);
      await db.insert(schema.planFeatures).values({ planId: planRow.id, featureId, value: JSON.stringify(value) });
    }
    for (const price of p.prices) {
      await db
        .insert(schema.prices)
        .values({ planId: planRow.id, regionCode: file.region, period: price.period, amount: price.amount, currency: file.currency, notes: price.notes ?? null })
        .onConflictDoUpdate({
          target: [schema.prices.planId, schema.prices.regionCode, schema.prices.period],
          set: { amount: price.amount, notes: price.notes ?? null, updatedAt: new Date().toISOString() },
        });
    }
  }

  for (const s of file.sources) {
    await db.insert(schema.sources).values({ productId, url: s.url, title: s.title ?? null, checkedAt: s.checkedAt ?? file.checkedAt });
  }
  let faqOrder = 0;
  for (const f of file.faq) {
    await db.insert(schema.faqs).values({ productId, question: f.q, answer: f.a, sortOrder: faqOrder++ });
  }
  await db.insert(schema.verifications).values({
    productId,
    verifiedAt: file.checkedAt,
    verifiedBy: "seed",
    status: hasUncertain ? "needs_review" : "verified",
    notes: hasUncertain ? "Seeded from research; some plans marked uncertain." : "Seeded from research against official sources.",
  });

  return existingProduct ? "updated" : "inserted";
}

export async function seedAll(opts: { update: boolean; text?: boolean; dir?: string }) {
  const dir = opts.dir ?? path.resolve(process.cwd(), "data/catalog");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const summary = { inserted: 0, updated: 0, skipped: 0, published: 0, draft: 0, errors: [] as string[] };
  for (const name of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      const parsed = catalogFileSchema.parse(raw);
      const result = await seedCatalogFile(parsed, opts);
      summary[result]++;
      if (result !== "skipped") {
        if (shouldPublish(parsed)) summary.published++;
        else summary.draft++;
      }
      console.log(`${result.padEnd(8)} ${parsed.company.slug} (${parsed.plans.length} plans, ${shouldPublish(parsed) ? "published" : "DRAFT – needs prices"})`);
    } catch (err) {
      const msg = `${name}: ${err instanceof Error ? err.message : String(err)}`;
      summary.errors.push(msg);
      console.error("ERROR", msg);
    }
  }
  return summary;
}

if (process.argv[1] && /seed\.(ts|js|cjs|mjs)$/.test(process.argv[1])) {
  const update = process.argv.includes("--update");
  const text = process.argv.includes("--text");
  seedAll({ update, text })
    .then((s) => {
      console.log("\nSeed complete:", s);
      process.exit(s.errors.length ? 1 : 0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
