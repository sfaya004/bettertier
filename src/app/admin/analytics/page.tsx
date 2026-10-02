import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";
import { DailyBars } from "@/components/admin/DailyBars";
import { getOverview, type RangeDays } from "@/lib/analytics";
import { STATUS_LABELS } from "@/lib/engine";
import type { FitStatus } from "@/lib/engine";

export const dynamic = "force-dynamic";

const RANGES: RangeDays[] = [7, 30, 90];

function pct(now: number, before: number): string | null {
  if (before === 0) return now > 0 ? "new" : null;
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return "no change";
  return `${change > 0 ? "▲" : "▼"} ${Math.abs(change)}% vs. previous period`;
}

function Stat({ label, value, note, sub }: { label: string; value: string; note?: string | null; sub?: string }) {
  return (
    <Card>
      <p className="text-[0.95rem] font-semibold text-[var(--color-ink-soft)]">{label}</p>
      <p className="mt-1 text-3xl font-bold leading-none">{value}</p>
      {sub ? <p className="mt-2 text-[0.95rem]">{sub}</p> : null}
      {note ? <p className="mt-1 text-[0.9rem] text-[var(--color-ink-soft)]">{note}</p> : null}
    </Card>
  );
}

function Table({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <Card>
      <h2 className="text-xl">{caption}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-[var(--color-ink-soft)]">Nothing yet.</p>
      ) : (
        <table className="mt-3 w-full text-[0.95rem]">
          <thead>
            <tr className="text-left text-[var(--color-ink-soft)]">
              {head.map((h, i) => (
                <th key={h} scope="col" className={`pb-1 font-semibold ${i > 0 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-[var(--color-line)]">
                {r.map((cell, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="py-1 pr-3 text-left font-normal break-all">
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className="py-1 text-right tabular-nums">
                      {typeof cell === "number" ? cell.toLocaleString("en-US") : cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export default async function AdminAnalytics({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const days = (RANGES.includes(Number(range) as RangeDays) ? Number(range) : 30) as RangeDays;
  const o = await getOverview(days);
  const money = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const conversion = o.visitors > 0 ? `${Math.round((o.checks / o.visitors) * 100)}% of visitors completed a check` : undefined;

  return (
    <div>
      <PageTitle lead="Everything in one place: traffic, how many people finish a check, what they find, and support clicks. No personal data is stored – only counts.">
        Analytics
      </PageTitle>

      <nav aria-label="Time range" className="mb-6 flex flex-wrap items-center gap-2">
        <span className="font-semibold mr-2">Show:</span>
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/admin/analytics?range=${r}`}
            aria-current={r === days ? "page" : undefined}
            className={`rounded-full border-2 px-4 py-2 no-underline font-semibold ${
              r === days ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white" : "border-[var(--color-line-strong)] bg-white text-[var(--color-brand)]"
            }`}
          >
            Last {r} days
          </Link>
        ))}
        <span className="ml-auto text-[0.95rem] text-[var(--color-ink-soft)]">Since {o.since} (UTC)</span>
      </nav>

      {!o.trackingEnabled ? (
        <Card tone="warn" className="mb-6">
          Page-view counting is switched off (<code>RECORD_PAGE_VIEWS=false</code>). Checks and events are still recorded.
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Visitors" value={o.visitors.toLocaleString("en-US")} note={pct(o.visitors, o.previous.visitors)} sub="Unique people per day, no cookies" />
        <Stat label="Page views" value={o.views.toLocaleString("en-US")} note={pct(o.views, o.previous.views)} />
        <Stat label="Checks completed" value={o.checks.toLocaleString("en-US")} note={pct(o.checks, o.previous.checks)} sub={conversion} />
        <Stat
          label="Savings found"
          value={o.savingsFound.toLocaleString("en-US")}
          sub={o.checks > 0 ? `${Math.round((o.savingsFound / o.checks) * 100)}% of checks · about ${money(o.savingsPerMonth)}/month surfaced` : undefined}
        />
        <Stat label="Support clicks" value={o.donateClicks.toLocaleString("en-US")} note={pct(o.donateClicks, o.previous.donateClicks)} sub="Clicks on a donate link" />
        <Stat label="Accounts created" value={o.signups.toLocaleString("en-US")} />
        <Stat label="Subscriptions saved" value={o.savedSubscriptions.toLocaleString("en-US")} sub="Added to a dashboard" />
        <Stat label="Searches with no match" value={o.searchesNoResults.toLocaleString("en-US")} sub="Ideas for subscriptions to add" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <DailyBars id="visitors" label="Visitors per day" points={o.perDay.map((p) => ({ day: p.day, value: p.visitors }))} />
        </Card>
        <Card>
          <DailyBars id="checks" label="Checks completed per day" points={o.perDay.map((p) => ({ day: p.day, value: p.checks }))} />
        </Card>
      </div>
      <details className="mt-3">
        <summary className="font-semibold text-[var(--color-brand)] cursor-pointer">Show the daily numbers as a table</summary>
        <table className="mt-2 text-[0.95rem]">
          <thead>
            <tr className="text-left text-[var(--color-ink-soft)]">
              <th scope="col" className="pr-4">Day</th>
              <th scope="col" className="pr-4 text-right">Visitors</th>
              <th scope="col" className="pr-4 text-right">Page views</th>
              <th scope="col" className="text-right">Checks</th>
            </tr>
          </thead>
          <tbody>
            {o.perDay.map((p) => (
              <tr key={p.day} className="border-t border-[var(--color-line)]">
                <th scope="row" className="pr-4 font-normal text-left">{p.day}</th>
                <td className="pr-4 text-right tabular-nums">{p.visitors}</td>
                <td className="pr-4 text-right tabular-nums">{p.views}</td>
                <td className="text-right tabular-nums">{p.checks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Table caption="Most visited pages" head={["Page", "Views", "Visitors"]} rows={o.topPages.map((r) => [r.path, r.views, r.visitors])} />
        <Table caption="Where visitors came from" head={["Site", "Visitors"]} rows={o.referrers.map((r) => [r.referrer, r.visitors])} />
        <Table
          caption="Subscriptions people checked"
          head={["Subscription", "Checks", "Found savings"]}
          rows={o.topProducts.map((r) => [r.product, r.checks, r.savings])}
        />
        <Table
          caption="What the results said"
          head={["Result", "Checks"]}
          rows={o.results.map((r) => [STATUS_LABELS[r.status as FitStatus]?.label ?? r.status, r.n])}
        />
        <Table caption="Devices" head={["Device", "Visitors"]} rows={o.devices.map((r) => [r.device, r.visitors])} />
        <Table caption="Buttons clicked after a result" head={["Button", "Clicks"]} rows={o.ctas.map((r) => [r.cta, r.n])} />
      </div>

      <Card className="mt-6">
        <h2 className="text-xl">Anonymous answer dataset</h2>
        <p className="mt-1">
          <strong>{o.totalAnswerRecords.toLocaleString("en-US")}</strong> completed comparisons recorded in total. Each row holds only the subscription, category, plan,
          the answers, the monthly price the person typed (if any) and the outcome, plus the calendar day – no user id, session, IP, browser or time of day.
        </p>
        <p className="mt-3">
          <a href="/admin/analytics/answers.csv">Download as CSV</a> · <a href="/admin/analytics/answers.jsonl">Download as JSONL</a> · from the command line:{" "}
          <code>npm run export-answers</code>
        </p>
      </Card>

      <p className="mt-6 text-[0.95rem] text-[var(--color-ink-soft)]">
        How visitors are counted: each page sends one ping with the page address and the referring site. The server combines the visitor&apos;s IP address and
        browser type with a secret that changes every day, hashes it, and keeps only that hash – so the same person is counted once per day but can never be
        identified or followed across days. No cookies are used, IP addresses are never stored, browsers that send &ldquo;Do Not Track&rdquo; are not counted, and
        admin pages are excluded.
      </p>
    </div>
  );
}
