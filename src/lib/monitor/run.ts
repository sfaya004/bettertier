import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { fetchPage, renderPage, robotsAllows } from "./fetch";
import { contentHash, extractPrices, htmlToText, priceAppears, summarizeDiff, type FoundPrice } from "./extract";
import { STALE_AFTER_DAYS } from "@/lib/engine/analyze";
import { anthropicCaller, recheckWithAI, type ModelCaller } from "./ai";
import { getProductDef } from "@/lib/catalog";

/** AI re-check settings (all optional). */
export function aiConfig(): { enabled: boolean; intervalDays: number; autoConfirm: boolean; caller: ModelCaller | null } {
  const key = process.env.ANTHROPIC_API_KEY;
  return {
    enabled: Boolean(key),
    intervalDays: Number(process.env.AI_RECHECK_DAYS ?? "7") || 7,
    autoConfirm: (process.env.AI_AUTO_CONFIRM ?? "true").toLowerCase() !== "false",
    caller: key ? anthropicCaller(key) : null,
  };
}

export interface MonitorReport {
  checked: number;
  skipped: number;
  changesCreated: number;
  aiChecked: number;
  aiConfirmed: number;
  details: { product: string; outcome: string }[];
  startedAt: string;
  finishedAt: string;
}

/** Politeness delay between requests to different hosts. */
const DELAY_MS = 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Create a pending change unless an identical pending one already exists. */
async function proposeChange(input: {
  productId: number;
  planId?: number | null;
  kind: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  evidence?: string | null;
  sourceUrl?: string | null;
}): Promise<boolean> {
  const existing = await db.query.planChanges.findFirst({
    where: and(
      eq(schema.planChanges.productId, input.productId),
      eq(schema.planChanges.kind, input.kind),
      eq(schema.planChanges.status, "pending"),
      input.planId ? eq(schema.planChanges.planId, input.planId) : isNull(schema.planChanges.planId),
      input.newValue ? eq(schema.planChanges.newValue, input.newValue) : or(isNull(schema.planChanges.newValue), eq(schema.planChanges.newValue, "")),
    ),
  });
  if (existing) return false;
  await db.insert(schema.planChanges).values({
    productId: input.productId,
    planId: input.planId ?? null,
    kind: input.kind,
    field: input.field ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    evidence: input.evidence ?? null,
    sourceUrl: input.sourceUrl ?? null,
  });
  return true;
}

/**
 * Check every monitored product's official pricing page and queue anything
 * suspicious for a human. Never modifies catalog prices by itself.
 */
export async function runMonitor(opts: { productSlug?: string; limit?: number; /** true = force AI re-check now, false = skip AI, undefined = per schedule */ ai?: boolean } = {}): Promise<MonitorReport> {
  const startedAt = new Date().toISOString();
  const report: MonitorReport = { checked: 0, skipped: 0, changesCreated: 0, aiChecked: 0, aiConfirmed: 0, details: [], startedAt, finishedAt: startedAt };
  const ai = opts.ai === false ? { ...aiConfig(), enabled: false } : aiConfig();
  if (opts.ai === true) ai.intervalDays = 0; // force

  const products = await db
    .select({
      id: schema.products.id,
      slug: schema.products.slug,
      name: schema.products.name,
      pricingUrl: schema.products.pricingUrl,
      monitorMode: schema.products.monitorMode,
      lastVerifiedAt: schema.products.lastVerifiedAt,
      lastAiCheckedAt: schema.products.lastAiCheckedAt,
      companyStatus: schema.companies.status,
    })
    .from(schema.products)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.products.companyId))
    .where(opts.productSlug ? eq(schema.products.slug, opts.productSlug) : eq(schema.companies.status, "published"));

  const now = new Date();
  for (const product of products.slice(0, opts.limit ?? products.length)) {
    // 1) Staleness check applies to every product, monitored or not.
    if (product.lastVerifiedAt) {
      const ageDays = (now.getTime() - new Date(product.lastVerifiedAt).getTime()) / 86_400_000;
      if (ageDays > STALE_AFTER_DAYS) {
        const created = await proposeChange({
          productId: product.id,
          kind: "stale",
          field: "last_verified_at",
          oldValue: product.lastVerifiedAt,
          evidence: `Last verified ${Math.floor(ageDays)} days ago (limit ${STALE_AFTER_DAYS}). Please re-check the official pricing page.`,
          sourceUrl: product.pricingUrl,
        });
        if (created) report.changesCreated++;
      }
    }

    if (!product.pricingUrl || product.monitorMode === "manual") {
      report.skipped++;
      report.details.push({ product: product.slug, outcome: product.pricingUrl ? "manual mode" : "no pricing URL" });
      continue;
    }

    // 2) Respect robots.txt.
    const robots = await robotsAllows(product.pricingUrl);
    if (!robots.allowed) {
      await db.update(schema.products).set({ monitorMode: "manual", lastCheckedAt: now.toISOString() }).where(eq(schema.products.id, product.id));
      const created = await proposeChange({
        productId: product.id,
        kind: "fetch_failed",
        evidence: `Automated checks are not permitted by the site's robots.txt (${robots.reason}). Switched this product to manual verification.`,
        sourceUrl: product.pricingUrl,
      });
      if (created) report.changesCreated++;
      report.skipped++;
      report.details.push({ product: product.slug, outcome: "robots.txt disallows – set to manual" });
      continue;
    }

    // 3) Fetch the page (plain HTTP, or a headless browser for JavaScript-built pages).
    const res = product.monitorMode === "render" ? await renderPage(product.pricingUrl) : await fetchPage(product.pricingUrl);
    report.checked++;
    const previous = await db.query.monitorSnapshots.findFirst({ where: eq(schema.monitorSnapshots.productId, product.id), orderBy: desc(schema.monitorSnapshots.fetchedAt) });
    const prevPrices: FoundPrice[] | null = previous?.pricesFound ? (JSON.parse(previous.pricesFound) as FoundPrice[]) : null;

    if (!res.ok) {
      await db.insert(schema.monitorSnapshots).values({ productId: product.id, url: product.pricingUrl, httpStatus: res.status, error: res.error ?? "fetch failed" });
      await db.update(schema.products).set({ lastCheckedAt: now.toISOString() }).where(eq(schema.products.id, product.id));
      // Only bother a human if it failed twice in a row.
      if (previous?.error) {
        const created = await proposeChange({
          productId: product.id,
          kind: "fetch_failed",
          evidence: `The pricing page could not be read twice in a row (${res.error}). It may block automated checks – consider manual verification.`,
          sourceUrl: product.pricingUrl,
        });
        if (created) report.changesCreated++;
      }
      report.details.push({ product: product.slug, outcome: `fetch failed: ${res.error}` });
      await sleep(DELAY_MS);
      continue;
    }

    const text = htmlToText(res.text);
    const found = extractPrices(text);
    const hash = contentHash(text);
    await db.insert(schema.monitorSnapshots).values({ productId: product.id, url: product.pricingUrl, httpStatus: res.status, contentHash: hash, pricesFound: JSON.stringify(found.slice(0, 200)) });
    await db.update(schema.products).set({ lastCheckedAt: now.toISOString() }).where(eq(schema.products.id, product.id));

    // 4) Compare known prices against what the page shows.
    const plans = await db.query.plans.findMany({ where: and(eq(schema.plans.productId, product.id), eq(schema.plans.status, "active")) });
    const planIds = plans.map((p) => p.id);
    const prices = planIds.length ? await db.query.prices.findMany({ where: inArray(schema.prices.planId, planIds) }) : [];
    const knownPrices = prices.filter((p) => p.amount !== null && p.amount > 0);

    // 4a) AI re-check of prices AND features against the page, on its own cadence.
    const aiDue = ai.enabled && text.length > 400 && (!product.lastAiCheckedAt || (now.getTime() - new Date(product.lastAiCheckedAt).getTime()) / 86_400_000 >= ai.intervalDays);
    let aiOutcome = "";
    if (aiDue && ai.caller) {
      const def = await getProductDef(product.slug, { includeDraft: true });
      if (def) {
        try {
          const r = await recheckWithAI(def, text, ai.caller);
          report.aiChecked++;
          await db.update(schema.products).set({ lastAiCheckedAt: now.toISOString() }).where(eq(schema.products.id, product.id));
          let created = 0;
          for (const c of r.changes) {
            const plan = c.planSlug ? plans.find((p) => p.slug === c.planSlug) ?? null : null;
            const ok = await proposeChange({
              productId: product.id,
              planId: plan?.id ?? null,
              kind: c.kind,
              field: c.field,
              oldValue: c.oldValue,
              newValue: c.newValue,
              evidence: `${c.evidence}${r.extraction.confidence !== "high" ? ` (model confidence: ${r.extraction.confidence})` : ""}`,
              sourceUrl: product.pricingUrl,
            });
            if (ok) created++;
          }
          report.changesCreated += created;
          const allMatch = r.changes.length === 0 && r.total > 0 && r.confirmed >= Math.ceil(r.total * 0.8) && r.extraction.confidence === "high";
          if (allMatch && ai.autoConfirm) {
            await db.update(schema.products).set({ lastVerifiedAt: now.toISOString(), verificationStatus: "verified" }).where(eq(schema.products.id, product.id));
            await db.insert(schema.verifications).values({ productId: product.id, verifiedAt: now.toISOString(), verifiedBy: "ai-monitor", status: "verified", notes: `Official page confirmed ${r.confirmed}/${r.total} catalog values; no differences found.` });
            await db
              .update(schema.planChanges)
              .set({ status: "approved", reviewedAt: now.toISOString(), reviewedBy: "ai-monitor", reviewNotes: "Resolved: page re-confirmed all values." })
              .where(and(eq(schema.planChanges.productId, product.id), eq(schema.planChanges.kind, "stale"), eq(schema.planChanges.status, "pending")));
            report.aiConfirmed++;
            aiOutcome = `AI confirmed ${r.confirmed}/${r.total} values – re-verified`;
          } else {
            aiOutcome = `AI: ${r.changes.length} proposal(s), confirmed ${r.confirmed}/${r.total}`;
          }
          if (r.extraction.notes) aiOutcome += ` – ${r.extraction.notes.slice(0, 120)}`;
        } catch (err) {
          aiOutcome = `AI check failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
    }

    if (found.length === 0) {
      if (aiOutcome) {
        report.details.push({ product: product.slug, outcome: `no $ prices in text; ${aiOutcome}` });
        await sleep(DELAY_MS);
        continue;
      }
      // Page is probably rendered by JavaScript; we can't read it. Flag once and move to manual.
      await db.update(schema.products).set({ monitorMode: "manual" }).where(eq(schema.products.id, product.id));
      const created = await proposeChange({
        productId: product.id,
        kind: "page_unreadable",
        evidence: `No prices could be read from the pricing page (it is probably built with JavaScript). Switched this product to manual verification. Consider pointing it at a help-centre page, or set monitor mode to "render" where a headless browser is available.`,
        sourceUrl: product.pricingUrl,
      });
      if (created) report.changesCreated++;
      report.details.push({ product: product.slug, outcome: "no prices readable – set to manual" });
      await sleep(DELAY_MS);
      continue;
    }

    let outcome = "ok";
    let missing = 0;
    for (const price of knownPrices) {
      if (!priceAppears(found, price.amount!)) {
        const plan = plans.find((p) => p.id === price.planId);
        const created = await proposeChange({
          productId: product.id,
          planId: price.planId,
          kind: "price_missing",
          field: `price:${price.period}`,
          oldValue: String(price.amount),
          evidence: `$${price.amount} (${plan?.name ?? "plan"}, ${price.period}) no longer appears on the pricing page. Prices seen: ${found
            .map((f) => f.raw)
            .slice(0, 12)
            .join(", ")}`,
          sourceUrl: product.pricingUrl,
        });
        if (created) report.changesCreated++;
        missing++;
      }
    }
    const diff = summarizeDiff(prevPrices, found);
    if (diff.added.length > 0 && prevPrices) {
      const knownSet = new Set(knownPrices.map((p) => p.amount));
      const newUnknown = diff.added.filter((a) => !knownSet.has(a));
      if (newUnknown.length > 0) {
        const created = await proposeChange({
          productId: product.id,
          kind: "price_new",
          newValue: newUnknown.map((a) => `$${a}`).join(", "),
          evidence: `New price(s) appeared on the page since the last check: ${newUnknown
            .map((a) => {
              const f = found.find((x) => x.amount === a);
              return f ? `${f.raw} – "…${f.context}…"` : `$${a}`;
            })
            .join(" | ")}`,
          sourceUrl: product.pricingUrl,
        });
        if (created) report.changesCreated++;
        outcome = `new prices: ${newUnknown.join(", ")}`;
      }
    }
    if (missing > 0) outcome = `${missing} known price(s) missing`;
    if (aiOutcome) outcome += `; ${aiOutcome}`;
    report.details.push({ product: product.slug, outcome });
    await sleep(DELAY_MS);
  }

  report.finishedAt = new Date().toISOString();
  await db
    .insert(schema.settings)
    .values({ key: "monitor:last_run", value: JSON.stringify({ ...report, details: report.details.slice(0, 100) }) })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: JSON.stringify({ ...report, details: report.details.slice(0, 100) }), updatedAt: new Date().toISOString() } });
  return report;
}
