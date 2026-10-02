import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Button, Card, PageTitle, inputClass } from "@/components/ui";
import { reviewChange } from "../actions";

const KIND_LABELS: Record<string, string> = {
  price_missing: "A known price no longer appears on the page",
  price_new: "A new price appeared on the page",
  page_unreadable: "Pricing page can't be read automatically",
  fetch_failed: "Pricing page could not be fetched",
  stale: "Not verified recently",
  ai_price: "Official page states a different price",
  ai_feature: "Official page states a different feature value",
  ai_new_plan: "A plan on the official page is not in the catalog",
  ai_plan_missing: "A catalog plan no longer appears on the official page",
  ai_discontinued: "Official page says this plan is no longer sold",
};

function applyPreview(field: string | null, newValue: string | null): string | null {
  if (!field || newValue === null) return null;
  if (field.startsWith("price:")) return `Approve & apply will set the ${field.slice(6)} price to $${newValue}.`;
  if (field.startsWith("feature:")) return `Approve & apply will set "${field.slice(8)}" to ${newValue}.`;
  if (field === "status") return `Approve & apply will mark the plan as ${newValue} (no longer sold to new customers).`;
  return null;
}

export default async function AdminChanges({ searchParams }: { searchParams: Promise<{ status?: string; product?: string }> }) {
  const { status = "pending", product } = await searchParams;
  const rows = await db
    .select({
      id: schema.planChanges.id,
      kind: schema.planChanges.kind,
      field: schema.planChanges.field,
      oldValue: schema.planChanges.oldValue,
      newValue: schema.planChanges.newValue,
      evidence: schema.planChanges.evidence,
      sourceUrl: schema.planChanges.sourceUrl,
      detectedAt: schema.planChanges.detectedAt,
      status: schema.planChanges.status,
      reviewedBy: schema.planChanges.reviewedBy,
      reviewNotes: schema.planChanges.reviewNotes,
      productSlug: schema.products.slug,
      productName: schema.products.name,
      planId: schema.planChanges.planId,
      planName: schema.plans.name,
    })
    .from(schema.planChanges)
    .innerJoin(schema.products, eq(schema.products.id, schema.planChanges.productId))
    .leftJoin(schema.plans, eq(schema.plans.id, schema.planChanges.planId))
    .where(eq(schema.planChanges.status, status))
    .orderBy(desc(schema.planChanges.detectedAt))
    .limit(200);
  const filtered = product ? rows.filter((r) => r.productSlug === product) : rows;

  return (
    <div>
      <PageTitle lead="Everything the price monitor found, waiting for a decision. Approve = I've looked and updated the data (or it was fine). Reject = false alarm.">Changes to review</PageTitle>
      <p className="mb-6">
        Show: <Link href="/admin/changes">pending</Link> · <Link href="/admin/changes?status=approved">approved</Link> · <Link href="/admin/changes?status=rejected">rejected</Link>
        {product ? <> · filtered to <strong>{product}</strong> (<Link href="/admin/changes">clear</Link>)</> : null}
      </p>
      {filtered.length === 0 ? <p>Nothing here.</p> : null}
      <div className="grid gap-4">
        {filtered.map((c) => (
          <Card key={c.id} tone={c.status === "pending" ? "warn" : "default"}>
            <p className="text-[0.9rem] text-[var(--color-ink-soft)]">{c.detectedAt.slice(0, 16).replace("T", " ")} · {c.kind}</p>
            <p className="mt-1 text-xl font-bold">
              <Link href={`/admin/companies/${c.productSlug}`}>{c.productName}</Link>
              {c.planName ? <> · {c.planName}</> : null}
            </p>
            <p className="mt-1 font-semibold">{KIND_LABELS[c.kind] ?? c.kind}</p>
            {c.field || c.oldValue || c.newValue ? (
              <p className="mt-2">
                {c.field ? <span className="text-[var(--color-ink-soft)]">{c.field}: </span> : null}
                {c.oldValue ?? "—"} → {c.newValue ?? "—"}
              </p>
            ) : null}
            {c.evidence ? <p className="mt-2 text-[0.95rem]">{c.evidence}</p> : null}
            {c.sourceUrl ? (
              <p className="mt-2">
                <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">Open the official page ↗</a>
                {c.planId ? <> · <Link href={`/admin/plans/${c.planId}`}>Edit this plan</Link></> : <> · <Link href={`/admin/companies/${c.productSlug}`}>Edit plans</Link></>}
              </p>
            ) : null}
            {c.status === "pending" ? (
              <form action={reviewChange.bind(null, "approve")} className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={c.id} />
                {applyPreview(c.field, c.newValue) && c.planId ? <p className="w-full font-semibold">{applyPreview(c.field, c.newValue)}</p> : null}
                <label className="block flex-1 min-w-64"><span className="font-semibold">Notes</span><input name="notes" className={inputClass} placeholder="optional" /></label>
                {applyPreview(c.field, c.newValue) && c.planId ? <Button type="submit" formAction={reviewChange.bind(null, "apply")}>Approve &amp; apply</Button> : null}
                <Button type="submit" formAction={reviewChange.bind(null, "approve")} variant={applyPreview(c.field, c.newValue) && c.planId ? "secondary" : "primary"}>{applyPreview(c.field, c.newValue) && c.planId ? "Approve without applying" : "Approve – reviewed"}</Button>
                <Button type="submit" formAction={reviewChange.bind(null, "reject")} variant="secondary">Reject – false alarm</Button>
              </form>
            ) : (
              <p className="mt-2 text-[0.95rem] text-[var(--color-ink-soft)]">{c.status} by {c.reviewedBy}{c.reviewNotes ? ` – ${c.reviewNotes}` : ""}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
