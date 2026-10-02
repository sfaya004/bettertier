import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageTitle } from "@/components/ui";
import { listPublishedProducts, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/catalog";
import { formatMoney } from "@/lib/engine/format";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "All subscription plans compared",
  description: `Every subscription ${SITE_NAME} covers, with current US plans and prices from official sources. Find out which plan fits what you actually use.`,
  alternates: { canonical: "/plans" },
};

export default async function PlansIndexPage() {
  const all = await listPublishedProducts();
  const byCategory = new Map<string, typeof all>();
  for (const p of all) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);

  return (
    <Container>
      <PageTitle lead={`${all.length} subscriptions, with every current plan and price recorded from the provider's official pages.`}>Subscription plans, compared</PageTitle>
      <nav aria-label="Categories" className="mb-8">
        <ul className="flex flex-wrap gap-2">
          {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => (
            <li key={c}>
              <a href={`#${c}`} className="inline-block rounded-full border-2 border-[var(--color-line-strong)] bg-white px-4 py-2 no-underline text-[var(--color-ink)] font-semibold hover:border-[var(--color-brand)]">
                {CATEGORY_LABELS[c]}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => (
        <section key={c} id={c} aria-labelledby={`${c}-h`} className="mb-10">
          <h2 id={`${c}-h`} className="text-2xl">
            {CATEGORY_LABELS[c]}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byCategory.get(c)!.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/plans/${p.slug}`}
                  className="block h-full rounded-[var(--radius-md)] border-2 border-[var(--color-line)] bg-white px-5 py-4 no-underline text-[var(--color-ink)] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
                >
                  <span className="block text-[1.15rem] font-bold">{p.name} plans</span>
                  <span className="block text-[var(--color-ink-soft)]">
                    {p.planCount} {p.planCount === 1 ? "plan" : "plans"}
                    {p.minMonthly !== null && p.maxMonthly !== null ? ` · ${p.minMonthly === p.maxMonthly ? formatMoney(p.minMonthly) : `${formatMoney(p.minMonthly)} – ${formatMoney(p.maxMonthly)}`}/mo` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Container>
  );
}
