import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Button, Card, PageTitle, inputClass } from "@/components/ui";
import { deleteFeature, updateFeature } from "../../actions";

export default async function AdminFeature({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const flags = await searchParams;
  const feature = await db.query.features.findFirst({ where: eq(schema.features.id, Number(id)) });
  if (!feature) notFound();
  const product = await db.query.products.findFirst({ where: eq(schema.products.id, feature.productId) });
  const pretty = (s: string | null) => {
    if (!s) return "";
    try {
      return JSON.stringify(JSON.parse(s), null, 2);
    } catch {
      return s;
    }
  };
  return (
    <div>
      <PageTitle lead={<Link href={`/admin/companies/${product?.slug}`}>← {product?.name}</Link>}>
        Feature: {feature.label}
      </PageTitle>
      {flags.saved ? <p role="status" className="mb-4 font-semibold text-[var(--color-good)]">Saved.</p> : null}
      {flags.error === "json" ? <p role="alert" className="mb-4 font-semibold text-[var(--color-danger)]">One of the JSON fields isn&apos;t valid JSON. Nothing was saved.</p> : null}
      <form action={updateFeature}>
        <input type="hidden" name="id" value={feature.id} />
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="sm:col-span-2 text-[var(--color-ink-soft)]">Key: <code>{feature.key}</code> (cannot be changed – plans refer to it)</p>
            <label className="block"><span className="font-semibold">Label (plain words, shown to users)</span><input name="label" defaultValue={feature.label} className={inputClass} /></label>
            <label className="block"><span className="font-semibold">Type</span>
              <select name="type" defaultValue={feature.type} className={inputClass}>
                <option value="number">number – user needs at least X</option>
                <option value="boolean">boolean – included or not</option>
                <option value="ordinal">ordinal – ordered levels</option>
                <option value="info">info – display only, never asked</option>
              </select>
            </label>
            <label className="block sm:col-span-2"><span className="font-semibold">Question (leave blank to never ask)</span><input name="question" defaultValue={feature.question ?? ""} className={inputClass} /></label>
            <label className="block sm:col-span-2"><span className="font-semibold">Help text (one or two plain sentences)</span><textarea name="help" rows={2} defaultValue={feature.help ?? ""} className={inputClass} /></label>
            <label className="block"><span className="font-semibold">Order (lower = asked first)</span><input name="sortOrder" type="number" defaultValue={feature.sortOrder} className={inputClass} /></label>
            <label className="block sm:col-span-2"><span className="font-semibold">Answer options (JSON array of {"{label, value}"}; not needed for boolean)</span>
              <textarea name="options" rows={6} defaultValue={pretty(feature.options)} className={`${inputClass} font-mono text-[0.9rem]`} placeholder='[{"label":"Just me","value":1},{"label":"2 people","value":2}]' />
            </label>
            <label className="block"><span className="font-semibold">Ordinal levels (JSON array, lowest → highest)</span>
              <textarea name="levels" rows={4} defaultValue={pretty(feature.levels)} className={`${inputClass} font-mono text-[0.9rem]`} placeholder='["hd","full_hd","4k"]' />
            </label>
            <label className="block"><span className="font-semibold">Level labels (JSON object)</span>
              <textarea name="levelLabels" rows={4} defaultValue={pretty(feature.levelLabels)} className={`${inputClass} font-mono text-[0.9rem]`} placeholder='{"hd":"Standard HD","4k":"4K Ultra HD"}' />
            </label>
          </div>
          <div className="mt-6"><Button type="submit">Save feature</Button></div>
        </Card>
      </form>
      <form action={deleteFeature} className="mt-10">
        <input type="hidden" name="id" value={feature.id} />
        <Button type="submit" variant="danger">Delete this feature (removes it from every plan)</Button>
      </form>
    </div>
  );
}
