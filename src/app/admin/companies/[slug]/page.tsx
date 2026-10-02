import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { Button, Card, PageTitle, inputClass } from "@/components/ui";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/catalog";
import { addFaq, addSource, createFeature, createPlan, deleteFaq, deleteSource, markVerified, updateCompany } from "../../actions";

export default async function AdminCompany({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ saved?: string; verified?: string; error?: string }> }) {
  const { slug } = await params;
  const flags = await searchParams;
  const company = await db.query.companies.findFirst({ where: eq(schema.companies.slug, slug) });
  const product = await db.query.products.findFirst({ where: eq(schema.products.slug, slug) });
  if (!company || !product) notFound();
  const plans = await db.query.plans.findMany({ where: eq(schema.plans.productId, product.id), orderBy: [asc(schema.plans.tier), asc(schema.plans.id)] });
  const features = await db.query.features.findMany({ where: eq(schema.features.productId, product.id), orderBy: asc(schema.features.sortOrder) });
  const sources = await db.query.sources.findMany({ where: eq(schema.sources.productId, product.id) });
  const faqs = await db.query.faqs.findMany({ where: eq(schema.faqs.productId, product.id), orderBy: asc(schema.faqs.sortOrder) });
  const prices = plans.length ? await db.query.prices.findMany({ where: eq(schema.prices.regionCode, "US") }) : [];
  const verifications = await db.query.verifications.findMany({ where: eq(schema.verifications.productId, product.id), orderBy: desc(schema.verifications.verifiedAt), limit: 5 });

  return (
    <div>
      <PageTitle lead={`/${slug} · ${company.status === "published" ? "Published" : "Draft – hidden from the public site"}`}>{company.name}</PageTitle>
      {flags.saved ? <p role="status" className="mb-4 font-semibold text-[var(--color-good)]">Saved.</p> : null}
      {flags.verified ? <p role="status" className="mb-4 font-semibold text-[var(--color-good)]">Marked as verified.</p> : null}
      {flags.error ? <p role="alert" className="mb-4 font-semibold text-[var(--color-danger)]">Something was missing – please check the form.</p> : null}
      <p className="mb-6">
        <Link href={`/plans/${slug}`}>View public page</Link> · <Link href={`/check/${slug}`}>Try the comparison</Link> · <Link href={`/admin/changes?product=${slug}`}>Pending changes</Link>
      </p>

      <Card>
        <h2 className="text-xl">Company &amp; product details</h2>
        <form action={updateCompany} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="slug" value={slug} />
          <L label="Company name"><input name="name" defaultValue={company.name} className={inputClass} /></L>
          <L label="Product name (shown to users)"><input name="productName" defaultValue={product.name} className={inputClass} /></L>
          <L label="Category">
            <select name="category" defaultValue={company.category} className={inputClass}>
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </L>
          <L label="Status">
            <select name="status" defaultValue={company.status} className={inputClass}>
              <option value="draft">Draft (hidden)</option>
              <option value="published">Published</option>
            </select>
          </L>
          <L label="Website"><input name="website" defaultValue={company.website ?? ""} className={inputClass} /></L>
          <L label="Official pricing page URL (monitored)"><input name="pricingUrl" defaultValue={product.pricingUrl ?? ""} className={inputClass} /></L>
          <L label="Monitor mode">
            <select name="monitorMode" defaultValue={product.monitorMode} className={inputClass}>
              <option value="auto">Automatic (fetch pricing page)</option>
              <option value="render">Automatic with headless browser (JavaScript pages; needs Playwright on the server)</option>
              <option value="manual">Manual only</option>
            </select>
          </L>
          <L label="Search aliases (comma separated)"><input name="aliases" defaultValue={company.aliases ?? ""} className={inputClass} /></L>
          <L label="Short description" wide><input name="shortDescription" defaultValue={company.shortDescription ?? ""} className={inputClass} /></L>
          <L label="How to find your plan (shown to users)" wide><textarea name="planHelp" defaultValue={product.planHelp ?? ""} rows={3} className={inputClass} /></L>
          <L label="Internal notes" wide><textarea name="notes" defaultValue={product.notes ?? ""} rows={3} className={inputClass} /></L>
          <label className="flex items-center gap-3 sm:col-span-2">
            <input type="checkbox" name="affiliateHasProgram" defaultChecked={company.affiliateHasProgram} className="h-6 w-6" />
            <span className="font-semibold">Has an affiliate program</span>
          </label>
          <L label="Affiliate link (used instead of the pricing link when set)"><input name="affiliateUrl" defaultValue={company.affiliateUrl ?? ""} className={inputClass} /></L>
          <L label="Affiliate notes"><input name="affiliateNotes" defaultValue={company.affiliateNotes ?? ""} className={inputClass} /></L>
          <div className="sm:col-span-2"><Button type="submit">Save details</Button></div>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl">Verification</h2>
        <p className="mt-1">
          Status: <strong>{product.verificationStatus}</strong> · Last verified: {product.lastVerifiedAt?.slice(0, 10) ?? "never"} · Last automated check: {product.lastCheckedAt?.slice(0, 10) ?? "never"}
        </p>
        <form action={markVerified} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="slug" value={slug} />
          <label className="block flex-1 min-w-64">
            <span className="font-semibold">Notes (optional)</span>
            <input name="notes" className={inputClass} placeholder="Checked all prices against the official page" />
          </label>
          <Button type="submit" variant="secondary">I checked the official page – mark verified today</Button>
        </form>
        {verifications.length ? (
          <ul className="mt-3 text-[0.95rem] text-[var(--color-ink-soft)]">
            {verifications.map((v) => (
              <li key={v.id}>{v.verifiedAt.slice(0, 10)} – {v.status} by {v.verifiedBy}{v.notes ? ` – ${v.notes}` : ""}</li>
            ))}
          </ul>
        ) : null}
      </Card>

      <h2 className="mt-10 text-2xl">Plans</h2>
      <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Table, scroll sideways to see more">
        <table className="text-[0.95rem]">
          <thead>
            <tr><th>Plan</th><th>Tier</th><th>Status</th><th>Confidence</th><th>Monthly</th><th>Annual</th></tr>
          </thead>
          <tbody>
            {plans.map((p) => {
              const m = prices.find((x) => x.planId === p.id && x.period === "monthly");
              const a = prices.find((x) => x.planId === p.id && x.period === "annual");
              return (
                <tr key={p.id}>
                  <th scope="row"><Link href={`/admin/plans/${p.id}`}>{p.name}</Link></th>
                  <td>{p.tier}</td>
                  <td>{p.status}</td>
                  <td>{p.confidence}</td>
                  <td>{m ? (m.amount === null ? "null" : `$${m.amount}`) : "—"}</td>
                  <td>{a ? (a.amount === null ? "null" : `$${a.amount}`) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form action={createPlan} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="productSlug" value={slug} />
        <label className="block"><span className="font-semibold">New plan slug</span><input name="planSlug" className={inputClass} required placeholder="premium" /></label>
        <label className="block"><span className="font-semibold">Name</span><input name="name" className={inputClass} required /></label>
        <label className="block w-28"><span className="font-semibold">Tier</span><input name="tier" type="number" className={inputClass} defaultValue={plans.length + 1} /></label>
        <Button type="submit" variant="secondary">Add plan</Button>
      </form>

      <h2 className="mt-10 text-2xl">Features (what the questions are about)</h2>
      <ul className="mt-3 grid gap-2">
        {features.map((f) => (
          <li key={f.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-3">
            <Link href={`/admin/features/${f.id}`} className="font-semibold">{f.label}</Link> <span className="text-[var(--color-ink-soft)]">· {f.key} · {f.type} · order {f.sortOrder}</span>
            {f.question ? <span className="block text-[var(--color-ink-soft)]">“{f.question}”</span> : null}
          </li>
        ))}
      </ul>
      <form action={createFeature} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="productSlug" value={slug} />
        <label className="block"><span className="font-semibold">New feature key</span><input name="key" className={inputClass} required placeholder="storage_gb" /></label>
        <label className="block"><span className="font-semibold">Label</span><input name="label" className={inputClass} required /></label>
        <label className="block"><span className="font-semibold">Type</span>
          <select name="type" className={inputClass}><option value="number">number</option><option value="boolean">boolean</option><option value="ordinal">ordinal</option><option value="info">info</option></select>
        </label>
        <Button type="submit" variant="secondary">Add feature</Button>
      </form>

      <h2 className="mt-10 text-2xl">Sources</h2>
      <ul className="mt-3 grid gap-2">
        {sources.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-2">
            <span><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title ?? s.url}</a> <span className="text-[var(--color-ink-soft)]">· {s.checkedAt?.slice(0, 10)}</span></span>
            <form action={deleteSource}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="productSlug" value={slug} /><Button type="submit" variant="danger" className="min-h-10 px-3 py-1 text-[0.9rem]">Remove</Button></form>
          </li>
        ))}
      </ul>
      <form action={addSource} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="productSlug" value={slug} />
        <label className="block flex-1 min-w-64"><span className="font-semibold">URL</span><input name="url" type="url" className={inputClass} required /></label>
        <label className="block flex-1 min-w-48"><span className="font-semibold">Title</span><input name="title" className={inputClass} /></label>
        <Button type="submit" variant="secondary">Add source</Button>
      </form>

      <h2 className="mt-10 text-2xl">FAQ</h2>
      <ul className="mt-3 grid gap-2">
        {faqs.map((f) => (
          <li key={f.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{f.question}</p><p className="text-[var(--color-ink-soft)]">{f.answer}</p></div>
              <form action={deleteFaq}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="productSlug" value={slug} /><Button type="submit" variant="danger" className="min-h-10 px-3 py-1 text-[0.9rem]">Remove</Button></form>
            </div>
          </li>
        ))}
      </ul>
      <form action={addFaq} className="mt-3 grid gap-3">
        <input type="hidden" name="productSlug" value={slug} />
        <label className="block"><span className="font-semibold">Question</span><input name="question" className={inputClass} required /></label>
        <label className="block"><span className="font-semibold">Answer</span><textarea name="answer" rows={2} className={inputClass} required /></label>
        <div><Button type="submit" variant="secondary">Add FAQ</Button></div>
      </form>
    </div>
  );
}

function L({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-semibold">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
