import "server-only";
import { and, desc, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export type RangeDays = 7 | 30 | 90;

export interface DayPoint {
  day: string;
  visitors: number;
  views: number;
  checks: number;
}

export interface Overview {
  days: RangeDays;
  since: string; // YYYY-MM-DD
  visitors: number;
  views: number;
  checks: number;
  savingsFound: number; // checks whose result was "paying for more than you need"
  savingsPerMonth: number; // sum of estimated monthly savings surfaced
  donateClicks: number;
  signups: number;
  savedSubscriptions: number;
  searchesNoResults: number;
  perDay: DayPoint[];
  topPages: { path: string; views: number; visitors: number }[];
  referrers: { referrer: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
  topProducts: { product: string; checks: number; savings: number }[];
  results: { status: string; n: number }[];
  ctas: { cta: string; n: number }[];
  previous: { visitors: number; views: number; checks: number; donateClicks: number };
  totalAnswerRecords: number;
  trackingEnabled: boolean;
}

function dayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sinceDay(days: number): string {
  return dayString(new Date(Date.now() - (days - 1) * 86_400_000));
}

const n = (v: unknown) => Number(v ?? 0);

export async function getOverview(days: RangeDays): Promise<Overview> {
  const since = sinceDay(days);
  const sinceIso = `${since}T00:00:00.000Z`;
  const prevSince = sinceDay(days * 2);
  const prevSinceIso = `${prevSince}T00:00:00.000Z`;
  const pv = schema.pageViews;
  const ev = schema.events;
  const ar = schema.answerRecords;

  const [traffic] = await db
    .select({ visitors: sql<number>`count(distinct ${pv.visitor} || ${pv.day})`, views: sql<number>`count(*)` })
    .from(pv)
    .where(gte(pv.day, since));
  const [prevTraffic] = await db
    .select({ visitors: sql<number>`count(distinct ${pv.visitor} || ${pv.day})`, views: sql<number>`count(*)` })
    .from(pv)
    .where(and(gte(pv.day, prevSince), sql`${pv.day} < ${since}`));

  const [checks] = await db
    .select({
      total: sql<number>`count(*)`,
      savingsFound: sql<number>`sum(case when ${ar.status} = 'over_subscribed' then 1 else 0 end)`,
      savingsPerMonth: sql<number>`coalesce(sum(case when ${ar.monthlyDifference} > 0 then ${ar.monthlyDifference} else 0 end), 0)`,
    })
    .from(ar)
    .where(gte(ar.recordedOn, since));
  const [prevChecks] = await db
    .select({ total: sql<number>`count(*)` })
    .from(ar)
    .where(and(gte(ar.recordedOn, prevSince), sql`${ar.recordedOn} < ${since}`));

  const eventCounts = await db
    .select({ name: ev.name, n: sql<number>`count(*)` })
    .from(ev)
    .where(gte(ev.createdAt, sinceIso))
    .groupBy(ev.name);
  const prevEvents = await db
    .select({ name: ev.name, n: sql<number>`count(*)` })
    .from(ev)
    .where(and(gte(ev.createdAt, prevSinceIso), sql`${ev.createdAt} < ${sinceIso}`))
    .groupBy(ev.name);
  const count = (rows: { name: string; n: number }[], name: string) => n(rows.find((r) => r.name === name)?.n);

  const viewsByDay = await db
    .select({ day: pv.day, visitors: sql<number>`count(distinct ${pv.visitor})`, views: sql<number>`count(*)` })
    .from(pv)
    .where(gte(pv.day, since))
    .groupBy(pv.day);
  const checksByDay = await db
    .select({ day: ar.recordedOn, checks: sql<number>`count(*)` })
    .from(ar)
    .where(gte(ar.recordedOn, since))
    .groupBy(ar.recordedOn);
  const perDay: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayString(new Date(Date.now() - i * 86_400_000));
    const v = viewsByDay.find((r) => r.day === day);
    const c = checksByDay.find((r) => r.day === day);
    perDay.push({ day, visitors: n(v?.visitors), views: n(v?.views), checks: n(c?.checks) });
  }

  const topPages = await db
    .select({ path: pv.path, views: sql<number>`count(*)`, visitors: sql<number>`count(distinct ${pv.visitor} || ${pv.day})` })
    .from(pv)
    .where(gte(pv.day, since))
    .groupBy(pv.path)
    .orderBy(desc(sql`count(*)`))
    .limit(15);
  const referrers = await db
    .select({ referrer: sql<string>`coalesce(${pv.referrer}, 'Direct / unknown')`, visitors: sql<number>`count(distinct ${pv.visitor} || ${pv.day})` })
    .from(pv)
    .where(gte(pv.day, since))
    .groupBy(sql`coalesce(${pv.referrer}, 'Direct / unknown')`)
    .orderBy(desc(sql`count(distinct ${pv.visitor} || ${pv.day})`))
    .limit(12);
  const devices = await db
    .select({ device: pv.device, visitors: sql<number>`count(distinct ${pv.visitor} || ${pv.day})` })
    .from(pv)
    .where(gte(pv.day, since))
    .groupBy(pv.device)
    .orderBy(desc(sql`count(distinct ${pv.visitor} || ${pv.day})`));

  const topProducts = await db
    .select({
      product: ar.productSlug,
      checks: sql<number>`count(*)`,
      savings: sql<number>`sum(case when ${ar.status} = 'over_subscribed' then 1 else 0 end)`,
    })
    .from(ar)
    .where(gte(ar.recordedOn, since))
    .groupBy(ar.productSlug)
    .orderBy(desc(sql`count(*)`))
    .limit(15);
  const results = await db
    .select({ status: ar.status, n: sql<number>`count(*)` })
    .from(ar)
    .where(gte(ar.recordedOn, since))
    .groupBy(ar.status)
    .orderBy(desc(sql`count(*)`));
  const ctas = await db
    .select({ cta: sql<string>`coalesce(json_extract(${ev.props}, '$.cta'), '?')`, n: sql<number>`count(*)` })
    .from(ev)
    .where(and(gte(ev.createdAt, sinceIso), sql`${ev.name} = 'cta_clicked'`))
    .groupBy(sql`json_extract(${ev.props}, '$.cta')`)
    .orderBy(desc(sql`count(*)`))
    .limit(10);
  const [total] = await db.select({ n: sql<number>`count(*)` }).from(ar);

  return {
    days,
    since,
    visitors: n(traffic?.visitors),
    views: n(traffic?.views),
    checks: n(checks?.total),
    savingsFound: n(checks?.savingsFound),
    savingsPerMonth: Number(checks?.savingsPerMonth ?? 0),
    donateClicks: count(eventCounts, "donate_clicked"),
    signups: count(eventCounts, "account_created"),
    savedSubscriptions: count(eventCounts, "subscription_saved"),
    searchesNoResults: count(eventCounts, "search_no_results"),
    perDay,
    topPages: topPages.map((r) => ({ path: r.path, views: n(r.views), visitors: n(r.visitors) })),
    referrers: referrers.map((r) => ({ referrer: r.referrer, visitors: n(r.visitors) })),
    devices: devices.map((r) => ({ device: r.device, visitors: n(r.visitors) })),
    topProducts: topProducts.map((r) => ({ product: r.product, checks: n(r.checks), savings: n(r.savings) })),
    results: results.map((r) => ({ status: r.status, n: n(r.n) })),
    ctas: ctas.map((r) => ({ cta: r.cta, n: n(r.n) })),
    previous: {
      visitors: n(prevTraffic?.visitors),
      views: n(prevTraffic?.views),
      checks: n(prevChecks?.total),
      donateClicks: count(prevEvents, "donate_clicked"),
    },
    totalAnswerRecords: n(total?.n),
    trackingEnabled: process.env.RECORD_PAGE_VIEWS !== "false",
  };
}
