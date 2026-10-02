import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageTitle } from "@/components/ui";
import { SearchBox } from "@/components/SearchBox";
import { getPopularProducts, listPublishedProducts, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Check a subscription",
  description: "Pick the subscription you pay for and find out whether you're on the right plan.",
  alternates: { canonical: "/check" },
  robots: { index: true, follow: true },
};

export default async function CheckPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [popular, all] = await Promise.all([getPopularProducts(), listPublishedProducts()]);
  const byCategory = new Map<string, typeof all>();
  for (const p of all) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);

  return (
    <Container narrow>
      <PageTitle lead="Step 1 of 3 · Choose the subscription you want to check.">What subscription do you want to check?</PageTitle>
      <SearchBox initialQuery={q ?? ""} />

      <section aria-labelledby="popular" className="mt-10">
        <h2 id="popular" className="text-xl">
          Or pick a popular one
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {popular.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/check/${p.slug}`}
                className="block rounded-[var(--radius-md)] border-2 border-[var(--color-line-strong)] bg-white px-5 py-4 min-h-14 no-underline text-[var(--color-ink)] font-semibold text-[1.05rem] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
              >
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <details className="mt-10 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-5 py-4">
        <summary className="font-semibold text-[var(--color-brand)] text-[1.05rem] min-h-10 flex items-center">Show every subscription we cover ({all.length})</summary>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => (
            <div key={c}>
              <h3 className="font-bold">{CATEGORY_LABELS[c]}</h3>
              <ul className="mt-2 grid gap-1">
                {byCategory.get(c)!.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/check/${p.slug}`} className="inline-block py-1">
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </Container>
  );
}
