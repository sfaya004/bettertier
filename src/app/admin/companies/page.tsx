import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Button, Card, PageTitle, inputClass } from "@/components/ui";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/catalog";
import { createCompany } from "../actions";

export default async function AdminCompanies({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  const { status, error } = await searchParams;
  const rows = await db
    .select({
      slug: schema.companies.slug,
      name: schema.companies.name,
      category: schema.companies.category,
      status: schema.companies.status,
      verificationStatus: schema.products.verificationStatus,
      lastVerifiedAt: schema.products.lastVerifiedAt,
      lastCheckedAt: schema.products.lastCheckedAt,
      monitorMode: schema.products.monitorMode,
      productId: schema.products.id,
      planCount: sql<number>`(select count(*) from plans p where p.product_id = ${schema.products.id} and p.status = 'active')`,
      pending: sql<number>`(select count(*) from plan_changes c where c.product_id = ${schema.products.id} and c.status = 'pending')`,
    })
    .from(schema.companies)
    .innerJoin(schema.products, eq(schema.products.companyId, schema.companies.id))
    .orderBy(asc(schema.companies.name));
  const filtered = status ? rows.filter((r) => r.status === status) : rows;

  return (
    <div>
      <PageTitle lead="Every subscription in the catalog. Drafts are hidden from the public site.">Companies &amp; plans</PageTitle>
      {error === "exists" ? <p role="alert" className="mb-4 font-semibold text-[var(--color-danger)]">That slug already exists.</p> : null}
      {error === "invalid" ? <p role="alert" className="mb-4 font-semibold text-[var(--color-danger)]">Slug must be lowercase letters, numbers and dashes.</p> : null}
      <p className="mb-4">
        Show: <Link href="/admin/companies">all ({rows.length})</Link> · <Link href="/admin/companies?status=published">published</Link> · <Link href="/admin/companies?status=draft">drafts</Link>
      </p>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table, scroll sideways to see more">
        <table className="text-[0.95rem]">
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Category</th>
              <th scope="col">Status</th>
              <th scope="col">Active plans</th>
              <th scope="col">Verification</th>
              <th scope="col">Last verified</th>
              <th scope="col">Monitor</th>
              <th scope="col">Pending</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.slug}>
                <th scope="row">
                  <Link href={`/admin/companies/${r.slug}`}>{r.name}</Link>
                </th>
                <td>{CATEGORY_LABELS[r.category] ?? r.category}</td>
                <td>{r.status === "published" ? "Published" : "Draft"}</td>
                <td>{r.planCount}</td>
                <td>{r.verificationStatus}</td>
                <td className="whitespace-nowrap">{r.lastVerifiedAt?.slice(0, 10) ?? "—"}</td>
                <td>{r.monitorMode}</td>
                <td>{r.pending > 0 ? <Link href={`/admin/changes?product=${r.slug}`}>{r.pending}</Link> : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card className="mt-10">
        <h2 className="text-xl">Add a new subscription</h2>
        <p className="mt-1 text-[var(--color-ink-soft)]">Creates a draft. Add plans, features and prices on the next screen, then publish.</p>
        <form action={createCompany} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="font-semibold">Slug (URL name)</span>
            <input name="slug" className={inputClass} required pattern="[a-z0-9-]+" placeholder="e.g. hbo-max" />
          </label>
          <label className="block">
            <span className="font-semibold">Company name</span>
            <input name="name" className={inputClass} required />
          </label>
          <label className="block">
            <span className="font-semibold">Category</span>
            <select name="category" className={inputClass}>
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-semibold">Official pricing page URL</span>
            <input name="pricingUrl" className={inputClass} type="url" />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Create draft</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
