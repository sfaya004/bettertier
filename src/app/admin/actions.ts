"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { runMonitor } from "@/lib/monitor/run";

function revalidateCatalog(slug?: string) {
  revalidatePath("/", "layout");
  revalidatePath("/plans");
  if (slug) {
    revalidatePath(`/plans/${slug}`);
    revalidatePath(`/plans/${slug}`, "layout");
    revalidatePath(`/check/${slug}`);
  }
}

const str = (v: FormDataEntryValue | null, max = 2000) => String(v ?? "").trim().slice(0, max);
const optStr = (v: FormDataEntryValue | null, max = 2000) => {
  const s = str(v, max);
  return s === "" ? null : s;
};
const num = (v: FormDataEntryValue | null) => {
  const s = str(v, 20).replace(/[$,]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/* ---------------- Companies / products ---------------- */

export async function updateCompany(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const slug = str(formData.get("slug"), 80);
  const company = await db.query.companies.findFirst({ where: eq(schema.companies.slug, slug) });
  const product = await db.query.products.findFirst({ where: eq(schema.products.slug, slug) });
  if (!company || !product) redirect("/admin/companies");
  const now = new Date().toISOString();
  await db
    .update(schema.companies)
    .set({
      name: str(formData.get("name"), 120) || company.name,
      category: str(formData.get("category"), 40) || company.category,
      website: optStr(formData.get("website"), 300),
      shortDescription: optStr(formData.get("shortDescription"), 300),
      aliases: optStr(formData.get("aliases"), 300),
      status: str(formData.get("status"), 20) === "published" ? "published" : "draft",
      affiliateHasProgram: formData.get("affiliateHasProgram") === "on",
      affiliateUrl: optStr(formData.get("affiliateUrl"), 500),
      affiliateNotes: optStr(formData.get("affiliateNotes"), 1000),
      updatedAt: now,
    })
    .where(eq(schema.companies.id, company.id));
  await db
    .update(schema.products)
    .set({
      name: str(formData.get("productName"), 120) || product.name,
      pricingUrl: optStr(formData.get("pricingUrl"), 500),
      planHelp: optStr(formData.get("planHelp"), 2000),
      notes: optStr(formData.get("notes"), 4000),
      monitorMode: ["auto", "render", "manual"].includes(str(formData.get("monitorMode"), 10)) ? str(formData.get("monitorMode"), 10) : "auto",
      updatedAt: now,
    })
    .where(eq(schema.products.id, product.id));
  void admin;
  revalidateCatalog(slug);
  redirect(`/admin/companies/${slug}?saved=1`);
}

export async function markVerified(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const slug = str(formData.get("slug"), 80);
  const product = await db.query.products.findFirst({ where: eq(schema.products.slug, slug) });
  if (!product) redirect("/admin/companies");
  const now = new Date().toISOString();
  await db.update(schema.products).set({ lastVerifiedAt: now, lastCheckedAt: now, verificationStatus: "verified", updatedAt: now }).where(eq(schema.products.id, product.id));
  await db.insert(schema.verifications).values({ productId: product.id, verifiedAt: now, verifiedBy: admin.email, status: "verified", notes: optStr(formData.get("notes"), 1000) });
  // Resolve any pending "stale" flags for this product.
  await db
    .update(schema.planChanges)
    .set({ status: "approved", reviewedAt: now, reviewedBy: admin.email, reviewNotes: "Resolved by manual verification." })
    .where(and(eq(schema.planChanges.productId, product.id), eq(schema.planChanges.kind, "stale"), eq(schema.planChanges.status, "pending")));
  revalidateCatalog(slug);
  redirect(`/admin/companies/${slug}?verified=1`);
}

export async function createCompany(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({ slug: z.string().regex(/^[a-z0-9-]{2,60}$/), name: z.string().min(1).max(120), category: z.string().min(1).max(40) })
    .safeParse({ slug: str(formData.get("slug"), 60), name: str(formData.get("name"), 120), category: str(formData.get("category"), 40) });
  if (!parsed.success) redirect("/admin/companies?error=invalid");
  const { slug, name, category } = parsed.data;
  const exists = await db.query.companies.findFirst({ where: eq(schema.companies.slug, slug) });
  if (exists) redirect("/admin/companies?error=exists");
  const [c] = await db.insert(schema.companies).values({ slug, name, category, status: "draft" }).returning({ id: schema.companies.id });
  await db.insert(schema.products).values({ companyId: c.id, slug, name, pricingUrl: optStr(formData.get("pricingUrl"), 500), verificationStatus: "unverified" });
  await db.insert(schema.regions).values({ code: "US", name: "United States", currency: "USD" }).onConflictDoNothing();
  redirect(`/admin/companies/${slug}`);
}

/* ---------------- Plans ---------------- */

export async function createPlan(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = str(formData.get("productSlug"), 80);
  const product = await db.query.products.findFirst({ where: eq(schema.products.slug, slug) });
  if (!product) redirect("/admin/companies");
  const planSlug = str(formData.get("planSlug"), 60).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const name = str(formData.get("name"), 120);
  if (!planSlug || !name) redirect(`/admin/companies/${slug}?error=plan`);
  const [plan] = await db
    .insert(schema.plans)
    .values({ productId: product.id, slug: planSlug, name, tier: num(formData.get("tier")) ?? 1, status: "active", confidence: "uncertain" })
    .returning({ id: schema.plans.id });
  // Give the plan an empty value for every feature so the editor shows all fields.
  const features = await db.query.features.findMany({ where: eq(schema.features.productId, product.id) });
  for (const f of features) await db.insert(schema.planFeatures).values({ planId: plan.id, featureId: f.id, value: "null" });
  redirect(`/admin/plans/${plan.id}`);
}

export async function updatePlan(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, id) });
  if (!plan) redirect("/admin/companies");
  const product = await db.query.products.findFirst({ where: eq(schema.products.id, plan.productId) });
  const now = new Date().toISOString();
  await db
    .update(schema.plans)
    .set({
      name: str(formData.get("name"), 120) || plan.name,
      tier: num(formData.get("tier")) ?? plan.tier,
      status: (["active", "grandfathered", "retired"].includes(str(formData.get("status"), 20)) ? str(formData.get("status"), 20) : plan.status) as string,
      confidence: str(formData.get("confidence"), 20) === "verified" ? "verified" : "uncertain",
      seatsIncluded: num(formData.get("seatsIncluded")),
      bestFor: optStr(formData.get("bestFor"), 300),
      notes: optStr(formData.get("notes"), 2000),
      updatedAt: now,
    })
    .where(eq(schema.plans.id, id));

  // Prices (US region) – record history when an amount changes.
  for (const period of ["monthly", "annual"] as const) {
    const raw = formData.get(`price_${period}`);
    if (raw === null) continue;
    const amount = num(raw);
    const existing = await db.query.prices.findFirst({ where: and(eq(schema.prices.planId, id), eq(schema.prices.regionCode, "US"), eq(schema.prices.period, period)) });
    if (existing) {
      if (existing.amount !== amount) {
        await db.update(schema.prices).set({ amount, updatedAt: now, notes: optStr(formData.get(`price_${period}_notes`), 500) }).where(eq(schema.prices.id, existing.id));
        await db.insert(schema.priceHistory).values({ planId: id, regionCode: "US", period, oldAmount: existing.amount, newAmount: amount, reason: `Edited by ${admin.email}` });
      } else {
        await db.update(schema.prices).set({ notes: optStr(formData.get(`price_${period}_notes`), 500) }).where(eq(schema.prices.id, existing.id));
      }
    } else if (amount !== null || str(formData.get(`price_${period}_notes`))) {
      await db.insert(schema.prices).values({ planId: id, regionCode: "US", period, amount, currency: "USD", notes: optStr(formData.get(`price_${period}_notes`), 500) });
      if (amount !== null) await db.insert(schema.priceHistory).values({ planId: id, regionCode: "US", period, oldAmount: null, newAmount: amount, reason: `Added by ${admin.email}` });
    }
  }

  // Feature values.
  const features = await db.query.features.findMany({ where: eq(schema.features.productId, plan.productId) });
  for (const f of features) {
    const raw = formData.get(`feature_${f.id}`);
    if (raw === null) continue;
    let value: string | number | boolean | null;
    const s = String(raw).trim();
    if (s === "" || s === "null") value = null;
    else if (f.type === "boolean") value = s === "true";
    else if (f.type === "number") value = Number.isFinite(Number(s)) ? Number(s) : null;
    else value = s.slice(0, 80);
    const existing = await db.query.planFeatures.findFirst({ where: and(eq(schema.planFeatures.planId, id), eq(schema.planFeatures.featureId, f.id)) });
    if (existing) await db.update(schema.planFeatures).set({ value: JSON.stringify(value) }).where(eq(schema.planFeatures.id, existing.id));
    else await db.insert(schema.planFeatures).values({ planId: id, featureId: f.id, value: JSON.stringify(value) });
  }
  if (product) revalidateCatalog(product.slug);
  redirect(`/admin/plans/${id}?saved=1`);
}

export async function deletePlan(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, id) });
  if (!plan) redirect("/admin/companies");
  const product = await db.query.products.findFirst({ where: eq(schema.products.id, plan.productId) });
  await db.delete(schema.plans).where(eq(schema.plans.id, id));
  if (product) revalidateCatalog(product.slug);
  redirect(`/admin/companies/${product?.slug ?? ""}`);
}

/* ---------------- Features ---------------- */

export async function updateFeature(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const feature = await db.query.features.findFirst({ where: eq(schema.features.id, id) });
  if (!feature) redirect("/admin/companies");
  const product = await db.query.products.findFirst({ where: eq(schema.products.id, feature.productId) });
  const parseJson = (v: FormDataEntryValue | null) => {
    const s = str(v, 4000);
    if (!s) return null;
    try {
      return JSON.stringify(JSON.parse(s));
    } catch {
      return "__invalid__";
    }
  };
  const options = parseJson(formData.get("options"));
  const levels = parseJson(formData.get("levels"));
  const levelLabels = parseJson(formData.get("levelLabels"));
  if ([options, levels, levelLabels].includes("__invalid__")) redirect(`/admin/features/${id}?error=json`);
  await db
    .update(schema.features)
    .set({
      label: str(formData.get("label"), 120) || feature.label,
      type: (["number", "boolean", "ordinal", "info"].includes(str(formData.get("type"), 10)) ? str(formData.get("type"), 10) : feature.type) as string,
      question: optStr(formData.get("question"), 300),
      help: optStr(formData.get("help"), 600),
      options,
      levels,
      levelLabels,
      sortOrder: num(formData.get("sortOrder")) ?? feature.sortOrder,
    })
    .where(eq(schema.features.id, id));
  if (product) revalidateCatalog(product.slug);
  redirect(`/admin/features/${id}?saved=1`);
}

export async function createFeature(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = str(formData.get("productSlug"), 80);
  const product = await db.query.products.findFirst({ where: eq(schema.products.slug, slug) });
  if (!product) redirect("/admin/companies");
  const key = str(formData.get("key"), 60).toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const label = str(formData.get("label"), 120);
  const type = str(formData.get("type"), 10);
  if (!key || !label || !["number", "boolean", "ordinal", "info"].includes(type)) redirect(`/admin/companies/${slug}?error=feature`);
  const existingCount = (await db.query.features.findMany({ where: eq(schema.features.productId, product.id) })).length;
  const [f] = await db.insert(schema.features).values({ productId: product.id, key, label, type, sortOrder: existingCount }).returning({ id: schema.features.id });
  const plans = await db.query.plans.findMany({ where: eq(schema.plans.productId, product.id) });
  for (const p of plans) await db.insert(schema.planFeatures).values({ planId: p.id, featureId: f.id, value: "null" });
  redirect(`/admin/features/${f.id}`);
}

export async function deleteFeature(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const feature = await db.query.features.findFirst({ where: eq(schema.features.id, id) });
  if (!feature) redirect("/admin/companies");
  const product = await db.query.products.findFirst({ where: eq(schema.products.id, feature.productId) });
  await db.delete(schema.features).where(eq(schema.features.id, id));
  if (product) revalidateCatalog(product.slug);
  redirect(`/admin/companies/${product?.slug ?? ""}`);
}

/* ---------------- Sources & FAQs ---------------- */

export async function addSource(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = str(formData.get("productSlug"), 80);
  const product = await db.query.products.findFirst({ where: eq(schema.products.slug, slug) });
  if (!product) redirect("/admin/companies");
  const url = str(formData.get("url"), 500);
  if (/^https?:\/\//.test(url)) await db.insert(schema.sources).values({ productId: product.id, url, title: optStr(formData.get("title"), 200), checkedAt: new Date().toISOString() });
  revalidateCatalog(slug);
  redirect(`/admin/companies/${slug}`);
}

export async function deleteSource(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const slug = str(formData.get("productSlug"), 80);
  await db.delete(schema.sources).where(eq(schema.sources.id, id));
  revalidateCatalog(slug);
  redirect(`/admin/companies/${slug}`);
}

export async function addFaq(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = str(formData.get("productSlug"), 80);
  const product = await db.query.products.findFirst({ where: eq(schema.products.slug, slug) });
  if (!product) redirect("/admin/companies");
  const question = str(formData.get("question"), 300);
  const answer = str(formData.get("answer"), 2000);
  if (question && answer) await db.insert(schema.faqs).values({ productId: product.id, question, answer, sortOrder: num(formData.get("sortOrder")) ?? 99 });
  revalidateCatalog(slug);
  redirect(`/admin/companies/${slug}`);
}

export async function deleteFaq(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const slug = str(formData.get("productSlug"), 80);
  await db.delete(schema.faqs).where(eq(schema.faqs.id, id));
  revalidateCatalog(slug);
  redirect(`/admin/companies/${slug}`);
}

/* ---------------- Change queue ---------------- */

/** Apply a proposed field change to the catalog. Returns a description of what was applied, or null. */
async function applyProposedChange(change: typeof schema.planChanges.$inferSelect, by: string): Promise<string | null> {
  if (!change.planId || !change.field) return null;
  const now = new Date().toISOString();
  if (change.field.startsWith("price:")) {
    const period = change.field.slice("price:".length);
    const amount = change.newValue === null ? null : Number(change.newValue);
    if (amount !== null && !Number.isFinite(amount)) return null;
    const existing = await db.query.prices.findFirst({ where: and(eq(schema.prices.planId, change.planId), eq(schema.prices.regionCode, "US"), eq(schema.prices.period, period)) });
    if (existing) await db.update(schema.prices).set({ amount, updatedAt: now }).where(eq(schema.prices.id, existing.id));
    else await db.insert(schema.prices).values({ planId: change.planId, regionCode: "US", period, amount, currency: "USD" });
    await db.insert(schema.priceHistory).values({ planId: change.planId, regionCode: "US", period, oldAmount: existing?.amount ?? null, newAmount: amount, reason: `Approved change #${change.id} by ${by}` });
    return `${period} price ${existing?.amount ?? "—"} → ${amount}`;
  }
  if (change.field.startsWith("feature:")) {
    const key = change.field.slice("feature:".length);
    const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, change.planId) });
    if (!plan) return null;
    const feature = await db.query.features.findFirst({ where: and(eq(schema.features.productId, plan.productId), eq(schema.features.key, key)) });
    if (!feature) return null;
    let value: string;
    try {
      value = JSON.stringify(change.newValue === null ? null : JSON.parse(change.newValue));
    } catch {
      value = JSON.stringify(change.newValue);
    }
    const existing = await db.query.planFeatures.findFirst({ where: and(eq(schema.planFeatures.planId, change.planId), eq(schema.planFeatures.featureId, feature.id)) });
    if (existing) await db.update(schema.planFeatures).set({ value }).where(eq(schema.planFeatures.id, existing.id));
    else await db.insert(schema.planFeatures).values({ planId: change.planId, featureId: feature.id, value });
    return `${feature.label} → ${value}`;
  }
  if (change.field === "status" && change.newValue) {
    await db.update(schema.plans).set({ status: change.newValue, updatedAt: now }).where(eq(schema.plans.id, change.planId));
    return `plan status → ${change.newValue}`;
  }
  return null;
}

/** Bound per button: reviewChange.bind(null, "apply" | "approve" | "reject") */
export async function reviewChange(rawDecision: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const raw = String(rawDecision);
  const decision = raw === "reject" ? "rejected" : "approved";
  const apply = raw === "apply";
  const change = await db.query.planChanges.findFirst({ where: eq(schema.planChanges.id, id) });
  if (!change) redirect("/admin/changes");
  const now = new Date().toISOString();
  let notes = optStr(formData.get("notes"), 1000);
  if (apply) {
    const applied = await applyProposedChange(change, admin.email);
    notes = [applied ? `Applied: ${applied}.` : "Nothing to apply automatically.", notes].filter(Boolean).join(" ");
  }
  await db.update(schema.planChanges).set({ status: decision, reviewedAt: now, reviewedBy: admin.email, reviewNotes: notes }).where(eq(schema.planChanges.id, id));
  if (decision === "approved" && (change.kind === "stale" || change.kind.startsWith("ai_"))) {
    // Approving a stale flag means "I re-checked it" – bump verification.
    await db.update(schema.products).set({ lastVerifiedAt: now, lastCheckedAt: now, verificationStatus: "verified" }).where(eq(schema.products.id, change.productId));
    await db.insert(schema.verifications).values({ productId: change.productId, verifiedAt: now, verifiedBy: admin.email, status: "verified", notes: "Re-verified from change queue." });
  }
  const product = await db.query.products.findFirst({ where: eq(schema.products.id, change.productId) });
  if (product) revalidateCatalog(product.slug);
  redirect("/admin/changes");
}

/* ---------------- Monitor ---------------- */

export async function runMonitorNow(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = optStr(formData.get("slug"), 80);
  const limit = num(formData.get("limit"));
  await runMonitor({ productSlug: slug ?? undefined, limit: limit ?? undefined, ai: formData.get("ai") === "on" ? true : undefined });
  redirect("/admin/monitor?ran=1");
}
