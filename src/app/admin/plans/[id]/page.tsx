import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Button, Card, PageTitle, inputClass } from "@/components/ui";
import { deletePlan, updatePlan } from "../../actions";

export default async function AdminPlan({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, Number(id)) });
  if (!plan) notFound();
  const product = await db.query.products.findFirst({ where: eq(schema.products.id, plan.productId) });
  const features = await db.query.features.findMany({ where: eq(schema.features.productId, plan.productId), orderBy: asc(schema.features.sortOrder) });
  const values = await db.query.planFeatures.findMany({ where: eq(schema.planFeatures.planId, plan.id) });
  const prices = await db.query.prices.findMany({ where: and(eq(schema.prices.planId, plan.id), eq(schema.prices.regionCode, "US")) });
  const history = await db.query.priceHistory.findMany({ where: eq(schema.priceHistory.planId, plan.id), orderBy: desc(schema.priceHistory.changedAt), limit: 10 });
  const monthly = prices.find((p) => p.period === "monthly");
  const annual = prices.find((p) => p.period === "annual");
  const valueFor = (featureId: number) => {
    const v = values.find((x) => x.featureId === featureId);
    if (!v || v.value === null) return "";
    try {
      const parsed = JSON.parse(v.value);
      return parsed === null ? "" : String(parsed);
    } catch {
      return "";
    }
  };

  return (
    <div>
      <PageTitle lead={<Link href={`/admin/companies/${product?.slug}`}>← {product?.name}</Link>}>
        {plan.name}
      </PageTitle>
      {saved ? <p role="status" className="mb-4 font-semibold text-[var(--color-good)]">Saved.</p> : null}
      <form action={updatePlan}>
        <input type="hidden" name="id" value={plan.id} />
        <Card>
          <h2 className="text-xl">Plan details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="font-semibold">Name</span><input name="name" defaultValue={plan.name} className={inputClass} /></label>
            <label className="block"><span className="font-semibold">Tier (1 = lowest)</span><input name="tier" type="number" defaultValue={plan.tier} className={inputClass} /></label>
            <label className="block"><span className="font-semibold">Status</span>
              <select name="status" defaultValue={plan.status} className={inputClass}>
                <option value="active">active – can be bought today</option>
                <option value="grandfathered">grandfathered – existing customers only</option>
                <option value="retired">retired – hidden everywhere</option>
              </select>
            </label>
            <label className="block"><span className="font-semibold">Confidence</span>
              <select name="confidence" defaultValue={plan.confidence} className={inputClass}>
                <option value="verified">verified – all values checked on official pages</option>
                <option value="uncertain">uncertain – something could not be verified</option>
              </select>
            </label>
            <label className="block"><span className="font-semibold">Seats included (family plans)</span><input name="seatsIncluded" type="number" defaultValue={plan.seatsIncluded ?? ""} className={inputClass} /></label>
            <label className="block sm:col-span-2"><span className="font-semibold">Best for (one plain sentence)</span><input name="bestFor" defaultValue={plan.bestFor ?? ""} className={inputClass} /></label>
            <label className="block sm:col-span-2"><span className="font-semibold">Notes (shown on public plan page)</span><textarea name="notes" rows={3} defaultValue={plan.notes ?? ""} className={inputClass} /></label>
          </div>
        </Card>

        <Card className="mt-6">
          <h2 className="text-xl">Prices (US, before tax)</h2>
          <p className="mt-1 text-[var(--color-ink-soft)]">Leave blank if the price could not be verified – the site will say “price not verified” rather than guess. Changes are logged in price history.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="font-semibold">Monthly price</span><input name="price_monthly" inputMode="decimal" defaultValue={monthly?.amount ?? ""} className={inputClass} /></label>
            <label className="block"><span className="font-semibold">Monthly price notes</span><input name="price_monthly_notes" defaultValue={monthly?.notes ?? ""} className={inputClass} /></label>
            <label className="block"><span className="font-semibold">Annual price (total per year)</span><input name="price_annual" inputMode="decimal" defaultValue={annual?.amount ?? ""} className={inputClass} /></label>
            <label className="block"><span className="font-semibold">Annual price notes</span><input name="price_annual_notes" defaultValue={annual?.notes ?? ""} className={inputClass} /></label>
          </div>
        </Card>

        <Card className="mt-6">
          <h2 className="text-xl">What this plan includes</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {features.map((f) => {
              const current = valueFor(f.id);
              const levels: string[] = f.levels ? (JSON.parse(f.levels) as string[]) : [];
              return (
                <label key={f.id} className="block">
                  <span className="font-semibold">{f.label}</span> <span className="text-[var(--color-ink-soft)]">({f.type})</span>
                  {f.type === "boolean" ? (
                    <select name={`feature_${f.id}`} defaultValue={current === "" ? "null" : current} className={inputClass}>
                      <option value="null">unknown / not verified</option>
                      <option value="true">yes – included</option>
                      <option value="false">no – not included</option>
                    </select>
                  ) : f.type === "ordinal" && levels.length ? (
                    <select name={`feature_${f.id}`} defaultValue={current === "" ? "null" : current} className={inputClass}>
                      <option value="null">unknown / not verified</option>
                      {levels.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  ) : (
                    <input name={`feature_${f.id}`} defaultValue={current} className={inputClass} placeholder={f.type === "number" ? "number, or blank for unknown" : "text"} />
                  )}
                </label>
              );
            })}
          </div>
        </Card>
        <div className="mt-6"><Button type="submit">Save plan</Button></div>
      </form>

      {history.length ? (
        <Card className="mt-8">
          <h2 className="text-xl">Price history</h2>
          <ul className="mt-2 text-[0.95rem]">
            {history.map((h) => (
              <li key={h.id}>{h.changedAt.slice(0, 10)} · {h.period}: {h.oldAmount ?? "—"} → {h.newAmount ?? "—"} {h.reason ? `(${h.reason})` : ""}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <form action={deletePlan} className="mt-10">
        <input type="hidden" name="id" value={plan.id} />
        <Button type="submit" variant="danger">Delete this plan permanently</Button>
      </form>
    </div>
  );
}
