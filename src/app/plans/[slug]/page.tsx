import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Container, LinkButton, SectionTitle } from "@/components/ui";
import { getProductDef, getProductExtras, listPublishedProducts, CATEGORY_LABELS } from "@/lib/catalog";
import { formatMoney, formatValue, monthlyEquivalent } from "@/lib/engine/format";
import { relevantFeatures } from "@/lib/engine/questions";
import { SITE_NAME, SITE_URL, formatDate, formatMonthYear, jsonLd } from "@/lib/site";
import { PlanPageViewed } from "@/components/PlanPageViewed";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDef(slug);
  if (!product) return { title: "Not found" };
  const names = product.plans.filter((p) => p.status === "active").map((p) => p.name);
  return {
    title: `${product.name} plans compared (${new Date().getFullYear()}): ${names.slice(0, 3).join(" vs ")}`,
    description: `Which ${product.name} plan should you get? Current US prices and what each plan includes, verified ${formatMonthYear(product.lastVerifiedAt)} from ${product.companyName}'s official pages. Find the plan that fits what you actually use.`,
    alternates: { canonical: `/plans/${slug}` },
  };
}

export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, extras] = await Promise.all([getProductDef(slug), getProductExtras(slug)]);
  if (!product || !extras) notFound();

  const active = product.plans.filter((p) => p.status === "active");
  const older = product.plans.filter((p) => p.status === "grandfathered");
  const features = product.features.filter((f) => f.type !== "info");
  const differing = relevantFeatures(product);
  const all = await listPublishedProducts();
  const related = all.filter((p) => p.category === product.category && p.slug !== product.slug).slice(0, 6);
  const pairs: [typeof active[number], typeof active[number]][] = [];
  for (let i = 0; i < active.length - 1; i++) pairs.push([active[i], active[i + 1]]);

  const jsonLdData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Plans", item: `${SITE_URL}/plans` },
        { "@type": "ListItem", position: 2, name: `${product.name} plans`, item: `${SITE_URL}/plans/${slug}` },
      ],
    },
    extras.faqs.length
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: extras.faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
        }
      : null,
  ].filter(Boolean);

  return (
    <Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(jsonLdData) }} />
      <PlanPageViewed product={product.slug} />
      <nav aria-label="Breadcrumb" className="mb-4 text-[0.95rem]">
        <Link href="/plans">All plans</Link> <span aria-hidden="true">›</span> <span>{CATEGORY_LABELS[product.category] ?? product.category}</span>
      </nav>
      <h1 className="text-3xl sm:text-4xl">{product.name} plans compared</h1>
      <p className="mt-3 text-[1.15rem] text-[var(--color-ink-soft)]">
        {extras.shortDescription ? `${extras.shortDescription} ` : ""}
        {active.length > 1
          ? `${product.companyName} currently sells ${active.length} plans in the US, from ${formatMoney(Math.min(...active.map((p) => monthlyEquivalent(p) ?? Infinity)))} a month. Here is what each one includes and who it suits.`
          : `${product.companyName} currently sells one plan in the US.`}
      </p>

      <Card tone="info" className="mt-6">
        <p className="text-xl font-bold">Which {product.name} plan is right for you?</p>
        <p className="mt-2">Answer a few plain-English questions and we&apos;ll check your answers against every plan. Takes about a minute. No account needed.</p>
        <div className="mt-4">
          <LinkButton href={`/check/${product.slug}`}>Find my best {product.name} plan</LinkButton>
        </div>
      </Card>

      <SectionTitle id="plans">Current {product.name} plans and prices</SectionTitle>
      <p className="text-[var(--color-ink-soft)]">
        Verified {formatDate(product.lastVerifiedAt)} from {product.companyName}&apos;s official pages. Prices are before tax and can change.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {active.map((p) => {
          const m = monthlyEquivalent(p);
          const annual = p.prices.find((x) => x.period === "annual" && x.amount !== null)?.amount ?? null;
          return (
            <Card key={p.slug}>
              <h3 className="text-xl">{p.name}</h3>
              <p className="mt-1 text-2xl font-bold">
                {m !== null ? formatMoney(m) : "Price not verified"} {m !== null ? <span className="text-[1rem] font-semibold">a month</span> : null}
              </p>
              {annual !== null ? <p className="text-[var(--color-ink-soft)]">or {formatMoney(annual)} a year</p> : null}
              {p.bestFor ? (
                <p className="mt-3">
                  <span className="font-semibold">Best for:</span> {p.bestFor}
                </p>
              ) : null}
              <ul className="mt-3 grid gap-1 text-[0.98rem]">
                {features.map((f) => (
                  <li key={f.key} className="flex justify-between gap-3 border-b border-[var(--color-line)] py-1">
                    <span className="text-[var(--color-ink-soft)]">{f.label}</span>
                    <span className="font-semibold text-right">{formatValue(f, p.features[f.key] ?? null)}</span>
                  </li>
                ))}
              </ul>
              {p.confidence === "uncertain" ? <p className="mt-3 text-[0.95rem] text-[var(--color-warn)]">Some details of this plan could not be verified from official pages.</p> : null}
            </Card>
          );
        })}
      </div>
      {older.length > 0 ? (
        <p className="mt-4 text-[var(--color-ink-soft)]">
          Older plans no longer sold to new customers: {older.map((p) => p.name).join(", ")}. If you&apos;re still on one, you can{" "}
          <Link href={`/check/${product.slug}`}>compare it here</Link>.
        </p>
      ) : null}

      {differing.length > 0 && active.length > 1 ? (
        <>
          <SectionTitle id="differences">What actually differs between the plans</SectionTitle>
          <p>
            Only {differing.length === 1 ? "one thing changes" : `${differing.length} things change`} as you move up the {product.name} plans:{" "}
            {differing.map((f) => f.label.toLowerCase()).join(", ")}. Everything else is the same on every plan, so those are the only questions worth asking yourself.
          </p>
          <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Table, scroll sideways to see more">
            <table>
              <caption className="sr-only">Differences between {product.name} plans</caption>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Price</th>
                  {differing.map((f) => (
                    <th key={f.key} scope="col">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.map((p) => (
                  <tr key={p.slug}>
                    <th scope="row">{p.name}</th>
                    <td className="whitespace-nowrap">{monthlyEquivalent(p) !== null ? `${formatMoney(monthlyEquivalent(p))}/mo` : "Not verified"}</td>
                    {differing.map((f) => (
                      <td key={f.key}>{formatValue(f, p.features[f.key] ?? null)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {pairs.length > 0 ? (
        <>
          <SectionTitle id="compare">Head-to-head comparisons</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pairs.map(([a, b]) => (
              <li key={`${a.slug}-${b.slug}`}>
                <Link href={`/plans/${product.slug}/${a.slug}-vs-${b.slug}`} className="block rounded-[var(--radius-md)] border-2 border-[var(--color-line)] bg-white px-5 py-4 font-semibold no-underline text-[var(--color-ink)] hover:border-[var(--color-brand)]">
                  {product.name} {a.name} vs {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {extras.faqs.length > 0 ? (
        <>
          <SectionTitle id="faq">Common questions about {product.name} plans</SectionTitle>
          <div className="grid gap-3">
            {extras.faqs.map((f) => (
              <details key={f.question} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-5 py-3">
                <summary className="font-semibold text-[1.05rem] min-h-10 flex items-center">{f.question}</summary>
                <p className="mt-3">{f.answer}</p>
              </details>
            ))}
          </div>
        </>
      ) : null}

      <SectionTitle id="sources">Where this information comes from</SectionTitle>
      <ul className="grid gap-2">
        {extras.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} rel="noopener noreferrer nofollow" target="_blank">
              {s.title ?? s.url} ↗
            </a>
            {s.checkedAt ? <span className="text-[var(--color-ink-soft)]"> – checked {formatDate(s.checkedAt)}</span> : null}
          </li>
        ))}
      </ul>
      {extras.notes ? <p className="mt-4 text-[0.95rem] text-[var(--color-ink-soft)]">{extras.notes}</p> : null}
      <p className="mt-4 text-[0.95rem] text-[var(--color-ink-soft)]">
        {SITE_NAME} is not affiliated with {product.companyName}. Plan names are used only to identify the plans being compared.
      </p>

      {related.length > 0 ? (
        <>
          <SectionTitle>Other {CATEGORY_LABELS[product.category]?.toLowerCase() ?? ""} subscriptions</SectionTitle>
          <ul className="flex flex-wrap gap-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/plans/${r.slug}`} className="inline-block rounded-full border-2 border-[var(--color-line-strong)] bg-white px-4 py-2 no-underline font-semibold text-[var(--color-ink)] hover:border-[var(--color-brand)]">
                  {r.name} plans
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="mt-12">
        <LinkButton href={`/check/${product.slug}`}>Find my best {product.name} plan</LinkButton>
      </div>
    </Container>
  );
}
