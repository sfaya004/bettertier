import Link from "next/link";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Card, PageTitle } from "@/components/ui";
import { STALE_AFTER_DAYS } from "@/lib/engine/analyze";

export default async function AdminHome() {
  const [published] = await db.select({ n: sql<number>`count(*)` }).from(schema.companies).where(eq(schema.companies.status, "published"));
  const [draft] = await db.select({ n: sql<number>`count(*)` }).from(schema.companies).where(eq(schema.companies.status, "draft"));
  const [pending] = await db.select({ n: sql<number>`count(*)` }).from(schema.planChanges).where(eq(schema.planChanges.status, "pending"));
  const [users] = await db.select({ n: sql<number>`count(*)` }).from(schema.users);
  const staleCutoff = new Date(Date.now() - STALE_AFTER_DAYS * 86_400_000).toISOString();
  const stale = await db
    .select({ slug: schema.products.slug, name: schema.products.name, lastVerifiedAt: schema.products.lastVerifiedAt })
    .from(schema.products)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.products.companyId))
    .where(and(eq(schema.companies.status, "published"), sql`coalesce(${schema.products.lastVerifiedAt}, '') < ${staleCutoff}`));
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [weekComparisons] = await db.select({ n: sql<number>`count(*)` }).from(schema.events).where(and(eq(schema.events.name, "comparison_completed"), gte(schema.events.createdAt, since)));
  const lastRun = await db.query.settings.findFirst({ where: eq(schema.settings.key, "monitor:last_run") });
  const run = lastRun ? (JSON.parse(lastRun.value) as { finishedAt: string; checked: number; changesCreated: number }) : null;

  return (
    <div>
      <PageTitle lead="What needs your attention.">Admin overview</PageTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Published subscriptions" value={published.n} href="/admin/companies" />
        <Stat label="Drafts (hidden)" value={draft.n} href="/admin/companies?status=draft" />
        <Stat label="Changes to review" value={pending.n} href="/admin/changes" tone={pending.n > 0 ? "warn" : "default"} />
        <Stat label="Comparisons, last 7 days" value={weekComparisons.n} href="/admin/analytics" />
      </div>
      <Card className="mt-6">
        <p className="font-bold">Price monitor</p>
        <p className="mt-1">
          {run ? `Last run finished ${new Date(run.finishedAt).toLocaleString("en-US")}: checked ${run.checked}, queued ${run.changesCreated} change(s).` : "Never run yet."}{" "}
          <Link href="/admin/monitor">Details</Link>
        </p>
      </Card>
      <Card tone={stale.length ? "warn" : "default"} className="mt-6">
        <p className="font-bold">Published subscriptions not verified in the last {STALE_AFTER_DAYS} days: {stale.length}</p>
        {stale.length ? (
          <ul className="mt-2 grid gap-1">
            {stale.map((s) => (
              <li key={s.slug}>
                <Link href={`/admin/companies/${s.slug}`}>{s.name}</Link> <span className="text-[var(--color-ink-soft)]">– {s.lastVerifiedAt ?? "never"}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      <p className="mt-6 text-[var(--color-ink-soft)]">{users.n} registered account(s).</p>
    </div>
  );
}

function Stat({ label, value, href, tone = "default" }: { label: string; value: number; href: string; tone?: "default" | "warn" }) {
  return (
    <Link href={href} className={`block rounded-[var(--radius-md)] border-2 p-4 no-underline text-[var(--color-ink)] ${tone === "warn" ? "border-[var(--color-warn)] bg-[var(--color-warn-soft)]" : "border-[var(--color-line)] bg-white"}`}>
      <span className="block text-3xl font-bold">{value}</span>
      <span className="block text-[var(--color-ink-soft)]">{label}</span>
    </Link>
  );
}
