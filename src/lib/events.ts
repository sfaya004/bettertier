import { db, schema } from "@/db";

/** Events we are willing to record. Anything else is dropped. */
export const ALLOWED_EVENTS = new Set([
  "subscription_analyzed",
  "comparison_completed",
  "recommendation_generated",
  "plan_page_viewed",
  "cta_clicked",
  "account_created",
  "subscription_saved",
  "donate_clicked",
  "search_no_results",
]);

/** Keys we allow in event properties – keeps PII out by construction. */
const ALLOWED_PROPS = new Set(["product", "status", "plan", "page", "cta", "count", "query_length"]);

export async function logEvent(name: string, props: Record<string, string | number | boolean> = {}): Promise<void> {
  if (!ALLOWED_EVENTS.has(name)) return;
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (ALLOWED_PROPS.has(k) && (typeof v === "string" ? v.length <= 80 : true)) clean[k] = v;
  }
  try {
    await db.insert(schema.events).values({ name, props: JSON.stringify(clean) });
  } catch (err) {
    console.error("event log failed", err);
  }
}
