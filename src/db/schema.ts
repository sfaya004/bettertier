/**
 * BetterTier database schema (Drizzle ORM, SQLite / libSQL).
 *
 * Catalog hierarchy:  Company -> Product -> Plan -> PlanFeature (value per Feature)
 *                                     \-> Feature (structured attribute + question copy)
 *                                     \-> Source (official URLs)
 * Pricing:            Plan -> Price (per Region + billing period), PriceHistory
 * Data maintenance:   MonitorSnapshot, PlanChange (verification queue), Verification
 * Users:              User, Session, UserSubscription (saved analyses)
 * Analytics:          Event (aggregate, no PII)
 *
 * JSON columns are stored as TEXT and parsed by the data-access layer.
 */
import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  website: text("website"),
  shortDescription: text("short_description"),
  /** Comma-separated alternate names used for search ("HBO, HBO Max") */
  aliases: text("aliases"),
  /** draft = hidden from the public site; published = live */
  status: text("status").notNull().default("draft"),
  affiliateHasProgram: integer("affiliate_has_program", { mode: "boolean" }).notNull().default(false),
  affiliateUrl: text("affiliate_url"),
  affiliateNotes: text("affiliate_notes"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    pricingUrl: text("pricing_url"),
    /** Plain-language instructions for finding which plan you are on */
    planHelp: text("plan_help"),
    notes: text("notes"),
    /** auto = fetch pricing page; render = fetch with a headless browser (JS pages); manual = humans only */
    monitorMode: text("monitor_mode").notNull().default("auto"),
    lastVerifiedAt: text("last_verified_at"),
    lastCheckedAt: text("last_checked_at"),
    /** Last time the AI extraction re-read the official page for this product */
    lastAiCheckedAt: text("last_ai_checked_at"),
    /** verified | needs_review | unverified */
    verificationStatus: text("verification_status").notNull().default("unverified"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("products_company_idx").on(t.companyId)],
);

export const features = sqliteTable(
  "features",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    /** number | boolean | ordinal | info */
    type: text("type").notNull(),
    /** JSON array of ordinal levels, lowest -> highest */
    levels: text("levels"),
    /** JSON object level -> human label */
    levelLabels: text("level_labels"),
    question: text("question"),
    help: text("help"),
    /** JSON array of {label, value} answer choices */
    options: text("options"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("features_product_key_idx").on(t.productId, t.key)],
);

export const plans = sqliteTable(
  "plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tier: integer("tier").notNull().default(1),
    /** active | grandfathered | retired */
    status: text("status").notNull().default("active"),
    /** verified | uncertain */
    confidence: text("confidence").notNull().default("verified"),
    seatsIncluded: integer("seats_included"),
    bestFor: text("best_for"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("plans_product_slug_idx").on(t.productId, t.slug)],
);

export const planFeatures = sqliteTable(
  "plan_features",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    planId: integer("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
    featureId: integer("feature_id").notNull().references(() => features.id, { onDelete: "cascade" }),
    /** JSON-encoded value: number | boolean | string | null */
    value: text("value"),
  },
  (t) => [uniqueIndex("plan_features_unique_idx").on(t.planId, t.featureId)],
);

export const regions = sqliteTable("regions", {
  code: text("code").primaryKey(), // e.g. "US"
  name: text("name").notNull(),
  currency: text("currency").notNull(), // e.g. "USD"
  taxNote: text("tax_note"),
});

export const prices = sqliteTable(
  "prices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    planId: integer("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
    regionCode: text("region_code").notNull().references(() => regions.code),
    /** monthly | annual | weekly | one-time */
    period: text("period").notNull(),
    /** null = price could not be verified */
    amount: real("amount"),
    currency: text("currency").notNull().default("USD"),
    isPromo: integer("is_promo", { mode: "boolean" }).notNull().default(false),
    notes: text("notes"),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("prices_unique_idx").on(t.planId, t.regionCode, t.period)],
);

export const priceHistory = sqliteTable(
  "price_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    planId: integer("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
    regionCode: text("region_code").notNull(),
    period: text("period").notNull(),
    oldAmount: real("old_amount"),
    newAmount: real("new_amount"),
    changedAt: text("changed_at").notNull().default(now),
    reason: text("reason"),
  },
  (t) => [index("price_history_plan_idx").on(t.planId)],
);

export const sources = sqliteTable(
  "sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    checkedAt: text("checked_at"),
  },
  (t) => [index("sources_product_idx").on(t.productId)],
);

export const faqs = sqliteTable(
  "faqs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("faqs_product_idx").on(t.productId)],
);

export const verifications = sqliteTable(
  "verifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    verifiedAt: text("verified_at").notNull().default(now),
    verifiedBy: text("verified_by").notNull(), // "seed", "monitor", or admin email
    status: text("status").notNull(), // verified | needs_review
    notes: text("notes"),
  },
  (t) => [index("verifications_product_idx").on(t.productId)],
);

/** Raw result of one automated check of a pricing page. */
export const monitorSnapshots = sqliteTable(
  "monitor_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    fetchedAt: text("fetched_at").notNull().default(now),
    httpStatus: integer("http_status"),
    contentHash: text("content_hash"),
    /** JSON array of price strings found on the page */
    pricesFound: text("prices_found"),
    error: text("error"),
  },
  (t) => [index("monitor_snapshots_product_idx").on(t.productId)],
);

/** A detected or proposed change awaiting a human decision. */
export const planChanges = sqliteTable(
  "plan_changes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    planId: integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
    /** price_missing | price_new | page_changed | fetch_failed | stale */
    kind: text("kind").notNull(),
    field: text("field"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    evidence: text("evidence"),
    sourceUrl: text("source_url"),
    detectedAt: text("detected_at").notNull().default(now),
    /** pending | approved | rejected */
    status: text("status").notNull().default("pending"),
    reviewedAt: text("reviewed_at"),
    reviewedBy: text("reviewed_by"),
    reviewNotes: text("review_notes"),
  },
  (t) => [index("plan_changes_status_idx").on(t.status), index("plan_changes_product_idx").on(t.productId)],
);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  /** user | admin */
  role: text("role").notNull().default("user"),
  createdAt: text("created_at").notNull().default(now),
  lastLoginAt: text("last_login_at"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // random 32-byte token (hashed)
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** A subscription the user has analyzed and saved to their account. */
export const userSubscriptions = sqliteTable(
  "user_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    planId: integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
    /** What the user says they pay (may differ from catalog) */
    userPrice: real("user_price"),
    period: text("period").notNull().default("monthly"),
    renewalDate: text("renewal_date"),
    /** JSON: answers to the needs questions */
    answers: text("answers").notNull().default("{}"),
    /** JSON: last recommendation result */
    result: text("result"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("user_subscriptions_user_idx").on(t.userId)],
);

/** Privacy-conscious aggregate analytics. No IP, no user id, no PII. */
export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    /** JSON of non-identifying properties (e.g. product slug, status) */
    props: text("props"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("events_name_idx").on(t.name), index("events_created_idx").on(t.createdAt)],
);

/**
 * Anonymous answer dataset. One row per completed comparison, holding ONLY the
 * subscription, the plan, the answers and the outcome. Deliberately no user id,
 * session, IP, user agent or precise timestamp – nothing that could link a row
 * to a person. Exportable as CSV/JSONL for analysis or licensing.
 */
export const answerRecords = sqliteTable(
  "answer_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productSlug: text("product_slug").notNull(),
    category: text("category").notNull(),
    /** null = "I'm not sure which plan I have" */
    currentPlanSlug: text("current_plan_slug"),
    /** What the person said they pay, monthly-equivalent, if they entered it */
    userMonthlyPrice: real("user_monthly_price"),
    /** JSON: feature key -> answer (null = "I'm not sure") */
    answers: text("answers").notNull(),
    questionsAsked: integer("questions_asked").notNull().default(0),
    status: text("status").notNull(),
    recommendedPlanSlug: text("recommended_plan_slug"),
    monthlyDifference: real("monthly_difference"),
    /** Calendar day only (YYYY-MM-DD) – coarse on purpose */
    recordedOn: text("recorded_on").notNull(),
  },
  (t) => [index("answer_records_product_idx").on(t.productSlug), index("answer_records_day_idx").on(t.recordedOn)],
);

/**
 * Privacy-friendly traffic counting (no cookies, no IP stored). `visitor` is a
 * salted hash of IP + user agent that changes every day, so it can count unique
 * visitors within a day but can never be turned back into a person or followed
 * across days. /admin and /api paths are never recorded.
 */
export const pageViews = sqliteTable(
  "page_views",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Normalised path, e.g. /plans/netflix (query strings dropped) */
    path: text("path").notNull(),
    /** Referrer host only, e.g. google.com; null = direct / unknown */
    referrer: text("referrer"),
    /** phone | tablet | desktop */
    device: text("device").notNull().default("desktop"),
    /** Daily-rotating anonymous visitor hash (16 hex chars) */
    visitor: text("visitor").notNull(),
    /** Calendar day (YYYY-MM-DD, UTC) */
    day: text("day").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("page_views_day_idx").on(t.day), index("page_views_path_idx").on(t.path)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(now),
});
