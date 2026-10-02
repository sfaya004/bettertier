import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Button, Card, PageTitle, inputClass } from "@/components/ui";
import { runMonitorNow } from "../actions";
import { aiConfig, type MonitorReport } from "@/lib/monitor/run";

export default async function AdminMonitor({ searchParams }: { searchParams: Promise<{ ran?: string }> }) {
  const { ran } = await searchParams;
  const ai = aiConfig();
  const lastRun = await db.query.settings.findFirst({ where: eq(schema.settings.key, "monitor:last_run") });
  const report = lastRun ? (JSON.parse(lastRun.value) as MonitorReport) : null;
  const snapshots = await db
    .select({ id: schema.monitorSnapshots.id, fetchedAt: schema.monitorSnapshots.fetchedAt, httpStatus: schema.monitorSnapshots.httpStatus, error: schema.monitorSnapshots.error, pricesFound: schema.monitorSnapshots.pricesFound, product: schema.products.slug })
    .from(schema.monitorSnapshots)
    .innerJoin(schema.products, eq(schema.products.id, schema.monitorSnapshots.productId))
    .orderBy(desc(schema.monitorSnapshots.fetchedAt))
    .limit(50);

  return (
    <div>
      <PageTitle lead="Re-reads each provider's official pricing page and queues anything suspicious. It never changes prices by itself. In production this runs on a schedule (see docs/DATA-UPDATES.md).">Price monitor</PageTitle>
      {ran ? <p role="status" className="mb-4 font-semibold text-[var(--color-good)]">Monitor run finished.</p> : null}
      <Card>
        <h2 className="text-xl">Run now</h2>
        <form action={runMonitorNow} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block"><span className="font-semibold">Only this product (slug, optional)</span><input name="slug" className={inputClass} placeholder="netflix" /></label>
          <label className="block w-40"><span className="font-semibold">Max products</span><input name="limit" type="number" className={inputClass} defaultValue={10} /></label>
          <label className="flex items-center gap-2 min-h-14"><input type="checkbox" name="ai" className="h-6 w-6" disabled={!ai.enabled} /> <span className="font-semibold">Force AI re-check now</span></label>
          <Button type="submit">Run monitor</Button>
        </form>
        <p className="mt-2">
          AI re-check: {ai.enabled ? `enabled (every ${ai.intervalDays} days per product; auto re-verify ${ai.autoConfirm ? "on" : "off"})` : "off – set ANTHROPIC_API_KEY to enable"}.
        </p>
        <p className="mt-2 text-[var(--color-ink-soft)]">Each product takes a few seconds (robots.txt + page fetch + a polite pause). Keep “max products” small when running from the browser.</p>
      </Card>
      {report ? (
        <Card className="mt-6">
          <h2 className="text-xl">Last run</h2>
          <p className="mt-1">{report.startedAt.slice(0, 16).replace("T", " ")} → {report.finishedAt.slice(11, 16)} · checked {report.checked} · skipped {report.skipped} · queued {report.changesCreated} · AI re-checked {report.aiChecked ?? 0} · auto re-verified {report.aiConfirmed ?? 0}</p>
          <ul className="mt-3 grid gap-1 text-[0.95rem]">
            {report.details.map((d, i) => (
              <li key={i}><code>{d.product}</code> – {d.outcome}</li>
            ))}
          </ul>
        </Card>
      ) : null}
      <h2 className="mt-10 text-2xl">Recent page snapshots</h2>
      <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Table, scroll sideways to see more">
        <table className="text-[0.9rem]">
          <thead><tr><th>When</th><th>Product</th><th>HTTP</th><th>Prices seen</th><th>Error</th></tr></thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap">{s.fetchedAt.slice(0, 16).replace("T", " ")}</td>
                <td>{s.product}</td>
                <td>{s.httpStatus ?? "—"}</td>
                <td>{s.pricesFound ? (JSON.parse(s.pricesFound) as { raw: string }[]).slice(0, 10).map((p) => p.raw).join(", ") : "—"}</td>
                <td>{s.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
