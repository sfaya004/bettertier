import Link from "next/link";
import { Container, LinkButton, Card } from "@/components/ui";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, jsonLd } from "@/lib/site";
import { getPopularProducts, countPublished } from "@/lib/catalog";

export const revalidate = 3600;

export default async function HomePage() {
  const [popular, count] = await Promise.all([getPopularProducts(), countPublished()]);
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/check?q={search_term_string}`, "query-input": "required name=search_term_string" },
  };

  return (
    <Container narrow>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(jsonLdData) }} />

      <section className="py-6 sm:py-10">
        <h1 className="text-4xl sm:text-5xl">Are you paying for the right subscription?</h1>
        <p className="mt-5 text-[1.25rem] text-[var(--color-ink-soft)]">
          Tell us what you actually use. We&apos;ll compare your current plan against the other plans from the same provider and show you whether you&apos;re paying
          for features you don&apos;t need – or missing one you do.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <LinkButton href="/check" className="text-[1.15rem] px-8">
            Check my subscription
          </LinkButton>
          <LinkButton href="/help" variant="secondary">
            How does this work?
          </LinkButton>
        </div>
        <p className="mt-5 text-[var(--color-ink-soft)]">Free. No account needed. We never ask for your passwords or bank details.</p>
      </section>

      <section aria-labelledby="how" className="mt-10">
        <h2 id="how" className="text-2xl">
          How it works
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            ["Choose your subscription", "Pick from Netflix, Spotify, Microsoft 365, ChatGPT and more."],
            ["Tell us what you actually need", "A few plain-English questions. Only the ones that matter for that service."],
            ["Compare your options", "We check your answers against every plan the provider sells today."],
            ["Understand your result", "A clear answer, what you'd gain or lose, and the estimated savings."],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-4 rounded-[var(--radius-lg)] border-2 border-[var(--color-line)] bg-white p-5">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)] text-white font-bold text-lg">
                {i + 1}
              </span>
              <div>
                <p className="font-bold text-[1.1rem]">{title}</p>
                <p className="mt-1 text-[var(--color-ink-soft)]">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="popular" className="mt-12">
        <h2 id="popular" className="text-2xl">
          Popular subscriptions to check
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {popular.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/check/${p.slug}`}
                className="block rounded-[var(--radius-md)] border-2 border-[var(--color-line-strong)] bg-white px-5 py-4 min-h-16 no-underline text-[var(--color-ink)] font-semibold text-[1.1rem] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
              >
                {p.name}
                <span className="block text-[0.95rem] font-normal text-[var(--color-ink-soft)]">{p.planCount} plans</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          <Link href="/plans">See all {count} subscriptions we cover</Link>
        </p>
      </section>

      <section aria-labelledby="why" className="mt-12">
        <h2 id="why" className="text-2xl">
          Why people use {SITE_NAME}
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["Personal, not generic", "The answer depends on what you use, not on what's cheapest."],
            ["Current plan information", "Every plan comes from the provider's official pages, with the date we last checked."],
            ["Honest about savings", "We show estimates, explain them, and tell you what you'd give up."],
            ["Independent", "No commissions, no sponsored plans – nothing influences which plan we recommend. If a plan doesn't fit, we say so."],
            ["No passwords, ever", "We don't connect to your accounts or your bank. You answer a few questions – that's it."],
            ["Easy to read", "Big text, plain language, and an “I'm not sure” option on every question."],
          ].map(([t, b]) => (
            <li key={t} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5">
              <p className="font-bold">
                <span aria-hidden="true" className="text-[var(--color-good)] mr-2">
                  ✓
                </span>
                {t}
              </p>
              <p className="mt-1 text-[var(--color-ink-soft)]">{b}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="trust" className="mt-12">
        <h2 id="trust" className="text-2xl">
          How we keep this trustworthy
        </h2>
        <Card className="mt-5">
          <dl className="grid gap-5">
            <div>
              <dt className="font-bold">Where the prices come from</dt>
              <dd className="mt-1 text-[var(--color-ink-soft)]">
                Every plan is recorded from the provider&apos;s official pricing or help page, with a link to the source and the date we last verified it. An
                automated checker re-reads those pages regularly and flags anything that looks different for a person to review.
              </dd>
            </div>
            <div>
              <dt className="font-bold">How recommendations are made</dt>
              <dd className="mt-1 text-[var(--color-ink-soft)]">
                We list what each plan includes as simple facts (how many people can watch, how much storage, ads or no ads). Your answers are checked against those
                facts. The plan we suggest is the least expensive one that covers everything you said you need – never just the cheapest.
              </dd>
            </div>
            <div>
              <dt className="font-bold">How we make money</dt>
              <dd className="mt-1 text-[var(--color-ink-soft)]">
                {SITE_NAME} is free, and it&apos;s paid for by optional donations from people who find it useful. No provider pays us for a link or a
                recommendation. <Link href="/support">How the site is supported</Link>.
              </dd>
            </div>
            <div>
              <dt className="font-bold">Your privacy</dt>
              <dd className="mt-1 text-[var(--color-ink-soft)]">
                You can use everything here without an account. Your answers stay in your browser unless you choose to save them. We never ask for passwords,
                card numbers or bank logins. <Link href="/privacy">Privacy policy</Link>.
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      <section className="mt-12 text-center">
        <LinkButton href="/check" className="text-[1.15rem] px-8">
          Check my subscription
        </LinkButton>
      </section>
    </Container>
  );
}
