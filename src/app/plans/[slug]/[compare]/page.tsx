import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Card, Container, LinkButton, SectionTitle } from "@/components/ui";
import { getProductDef } from "@/lib/catalog";
import { formatMoney, formatValue, monthlyEquivalent, round2 } from "@/lib/engine/format";
import { isMore } from "@/lib/engine/compare";
import { SITE_URL, formatDate, jsonLd } from "@/lib/site";

export const revalidate = 3600;

function parsePair(compare: string, slugs: string[]): [string, string] | null {
  // Slugs can contain "-", so try every split point around "-vs-".
  const idx = compare.indexOf("-vs-");
  if (idx < 0) return null;
  let pos = idx;
  while (pos >= 0) {
    const a = compare.slice(0, pos);
    const b = compare.slice(pos + 4);
    if (slugs.includes(a) && slugs.includes(b) && a !== b) return [a, b];
    pos = compare.indexOf("-vs-", pos + 1);
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; compare: string }> }): Promise<Metadata> {
  const { slug, compare } = await params;
  const product = await getProductDef(slug);
  if (!product) return { title: "Not found" };
  const pair = parsePair(compare, product.plans.map((p) => p.slug));
  if (!pair) return { title: "Not found" };
  const a = product.plans.find((p) => p.slug === pair[0])!;
  const b = product.plans.find((p) => p.slug === pair[1])!;
  return {
    title: `${product.name} ${a.name} vs ${b.name}: which should you pay for?`,
    description: `${product.name} ${a.name} (${formatMoney(monthlyEquivalent(a))}/mo) vs ${b.name} (${formatMoney(monthlyEquivalent(b))}/mo). Exactly what you get for the extra money, and who should pick which. Verified from ${product.companyName}'s official pages.`,
    alternates: { canonical: `/plans/${slug}/${compare}` },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string; compare: string }> }) {
  const { slug, compare } = await params;
  const product = await getProductDef(slug);
  if (!product) notFound();
  const pair = parsePair(compare, product.plans.map((p) => p.slug));
  if (!pair) notFound();
  let a = product.plans.find((p) => p.slug === pair[0])!;
  let b = product.plans.find((p) => p.slug === pair[1])!;
  // Canonical order: lower tier first.
  if (a.tier > b.tier || (a.tier === b.tier && (monthlyEquivalent(a) ?? 0) > (monthlyEquivalent(b) ?? 0))) {
    permanentRedirect(`/plans/${slug}/${b.slug}-vs-${a.slug}`);
  }
  if (a.tier > b.tier) [a, b] = [b, a];

  const ma = monthlyEquivalent(a);
  const mb = monthlyEquivalent(b);
  const diff = ma !== null && mb !== null ? round2(mb - ma) : null;
  const features = product.features.filter((f) => f.type !== "info");
  const gains = features.filter((f) => isMore(f, b.features[f.key] ?? null, a.features[f.key] ?? null));
  const losses = features.filter((f) => isMore(f, a.features[f.key] ?? null, b.features[f.key] ?? null));
  const same = features.filter((f) => !gains.includes(f) && !losses.includes(f));

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Plans", item: `${SITE_URL}/plans` },
      { "@type": "ListItem", position: 2, name: `${product.name} plans`, item: `${SITE_URL}/plans/${slug}` },
      { "@type": "ListItem", position: 3, name: `${a.name} vs ${b.name}`, item: `${SITE_URL}/plans/${slug}/${compare}` },
    ],
  };

  return (
    <Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(jsonLdData) }} />
      <nav aria-label="Breadcrumb" className="mb-4 text-[0.95rem]">
        <Link href="/plans">All plans</Link> <span aria-hidden="true">›</span> <Link href={`/plans/${slug}`}>{product.name} plans</Link>
      </nav>
      <h1 className="text-3xl sm:text-4xl">
        {product.name} {a.name} vs {b.name}
      </h1>
      <p className="mt-3 text-[1.15rem] text-[var(--color-ink-soft)]">
        {diff !== null && diff > 0
          ? `${b.name} costs ${formatMoney(diff)} more a month (${formatMoney(round2(diff * 12))} a year) than ${a.name}. Here is exactly what that extra money buys.`
          : `Here is exactly how ${a.name} and ${b.name} differ.`}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[a, b].map((p) => (
          <Card key={p.slug}>
            <h2 className="text-xl">{p.name}</h2>
            <p className="mt-1 text-2xl font-bold">
              {monthlyEquivalent(p) !== null ? formatMoney(monthlyEquivalent(p)) : "Price not verified"} <span className="text-[1rem] font-semibold">a month</span>
            </p>
            {p.bestFor ? (
              <p className="mt-2">
                <span className="font-semibold">Best for:</span> {p.bestFor}
              </p>
            ) : null}
          </Card>
        ))}
      </div>

      {gains.length > 0 ? (
        <>
          <SectionTitle>What you get by choosing {b.name}</SectionTitle>
          <ul className="grid gap-2">
            {gains.map((f) => (
              <li key={f.key} className="flex gap-3">
                <span aria-hidden="true" className="font-bold text-[var(--color-good)]">
                  +
                </span>
                <span>
                  <span className="font-semibold">{f.label}:</span> {formatValue(f, b.features[f.key] ?? null)} <span className="text-[var(--color-ink-soft)]">(instead of {formatValue(f, a.features[f.key] ?? null)})</span>
                  {f.help ? <span className="block text-[0.95rem] text-[var(--color-ink-soft)]">{f.help}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {losses.length > 0 ? (
        <>
          <SectionTitle>What only {a.name} has</SectionTitle>
          <ul className="grid gap-2">
            {losses.map((f) => (
              <li key={f.key} className="flex gap-3">
                <span aria-hidden="true" className="font-bold text-[var(--color-warn)]">
                  –
                </span>
                <span>
                  <span className="font-semibold">{f.label}:</span> {formatValue(f, a.features[f.key] ?? null)} on {a.name}, {formatValue(f, b.features[f.key] ?? null)} on {b.name}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {same.length > 0 ? (
        <>
          <SectionTitle>Same on both</SectionTitle>
          <p>
            {same.map((f) => `${f.label.toLowerCase()} (${formatValue(f, a.features[f.key] ?? null).toLowerCase()})`).join(", ")}.
          </p>
        </>
      ) : null}

      <Card tone="info" className="mt-10">
        <p className="text-xl font-bold">Which one should you pick?</p>
        <p className="mt-2">
          It depends on what you actually use. {gains.length > 0 ? `If you don't need ${gains.map((g) => g.label.toLowerCase()).join(" or ")}, ${a.name} does the same job for less.` : ""} Answer a
          few questions and we&apos;ll tell you which plan fits.
        </p>
        <div className="mt-4">
          <LinkButton href={`/check/${product.slug}`}>Find my best {product.name} plan</LinkButton>
        </div>
      </Card>

      <p className="mt-8 text-[0.95rem] text-[var(--color-ink-soft)]">
        Prices and features verified {formatDate(product.lastVerifiedAt)} from {product.companyName}&apos;s official pages
        {product.pricingUrl ? (
          <>
            {" "}
            (<a href={product.pricingUrl} rel="noopener noreferrer nofollow" target="_blank">source ↗</a>)
          </>
        ) : null}
        . Prices are before tax and can change. <Link href={`/plans/${slug}`}>See all {product.name} plans</Link>.
      </p>
    </Container>
  );
}
