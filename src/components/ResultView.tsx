"use client";

import Link from "next/link";
import type { AnalysisResult, PlanEvaluation, ProductDef } from "@/lib/engine/types";
import { formatMoney, formatValue } from "@/lib/engine/format";
import { STATUS_LABELS } from "@/lib/engine/analyze";
import { Badge, Card, Details, LinkButton } from "./ui";
import { formatMonthYear, DONATE_URL, SITE_NAME } from "@/lib/site";
import { track } from "@/lib/store";

/**
 * The result screen. Conclusion first, then why, then what you'd lose,
 * then options. Everything else is behind "show more".
 */
export function ResultView({
  result,
  product,
  actions,
}: {
  result: AnalysisResult;
  product: ProductDef;
  actions?: React.ReactNode;
}) {
  const s = STATUS_LABELS[result.status];
  const savings = result.monthlyDifference ?? 0;
  const rec = result.recommendedPlan;
  const cur = result.currentPlan;
  const switching = rec && cur && rec.plan.slug !== cur.plan.slug;

  return (
    <div>
      <Badge tone={s.tone} symbol={s.symbol}>
        {s.label}
      </Badge>
      <h1 className="mt-4 text-3xl sm:text-4xl">{result.headline}</h1>
      <p className="mt-4 text-[1.15rem]">{result.summary}</p>

      {/* Money, when we can say something about it */}
      {result.status === "over_subscribed" || (result.status === "needs_review" && savings > 0) ? (
        <Card tone="good" className="mt-6">
          <p className="text-[1.05rem] font-semibold">Estimated savings if you switch to {rec?.plan.name}</p>
          <p className="mt-2 text-3xl font-bold">
            {formatMoney(savings)} <span className="text-xl font-semibold">a month</span>
          </p>
          <p className="text-2xl font-bold">
            {formatMoney(result.annualDifference)} <span className="text-lg font-semibold">a year</span>
          </p>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            An estimate based on your answers and prices published by {product.companyName}. Taxes, promotions and add-ons can change the exact amount.
          </p>
        </Card>
      ) : null}
      {result.status === "under_subscribed" && rec && result.monthlyDifference !== null ? (
        <Card tone="info" className="mt-6">
          <p className="text-[1.05rem] font-semibold">What the {rec.plan.name} plan would cost</p>
          <p className="mt-2 text-3xl font-bold">
            {formatMoney(rec.monthlyCost)} <span className="text-xl font-semibold">a month</span>
          </p>
          <p className="mt-2">
            {result.monthlyDifference < 0
              ? `That's about ${formatMoney(Math.abs(result.monthlyDifference))} more a month than you pay now (${formatMoney(Math.abs(result.annualDifference ?? 0))} a year).`
              : `That's about ${formatMoney(result.monthlyDifference)} a month less than you pay now.`}
          </p>
        </Card>
      ) : null}

      {/* Side-by-side, only the two plans that matter */}
      {cur ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <PlanSummary title="Your current plan" evaluation={cur} tone="default" note={switching && result.featuresLost.length > 0 ? "Covers what you need, plus things you said you don't use" : undefined} />
          {switching && rec ? <PlanSummary title="Plan that fits your answers" evaluation={rec} tone="good" /> : null}
          {!switching && rec === null && result.status !== "good_fit" ? (
            <Card>
              <p className="font-bold">No clear alternative</p>
              <p className="mt-2 text-[var(--color-ink-soft)]">We couldn&apos;t find a plan with a verified price that covers everything you asked for.</p>
            </Card>
          ) : null}
        </div>
      ) : rec ? (
        <div className="mt-8">
          <PlanSummary title="Plan that fits your answers" evaluation={rec} tone="good" />
        </div>
      ) : null}

      {result.reasons.length > 0 ? (
        <section className="mt-8" aria-labelledby="why">
          <h2 id="why" className="text-2xl">
            Why?
          </h2>
          <ul className="mt-3 grid gap-2">
            {result.reasons.map((r) => (
              <li key={r} className="flex gap-3">
                <span aria-hidden="true" className="text-[var(--color-good)] font-bold">
                  ✓
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.uncertainties.length > 0 ? (
        <section className="mt-8" aria-labelledby="unsure">
          <h2 id="unsure" className="text-2xl">
            Before you decide
          </h2>
          <ul className="mt-3 grid gap-2">
            {result.uncertainties.map((r) => (
              <li key={r} className="flex gap-3">
                <span aria-hidden="true" className="text-[var(--color-warn)] font-bold">
                  ?
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {switching && (result.featuresLost.length > 0 || result.featuresGained.length > 0) ? (
        <section className="mt-8 grid gap-4 sm:grid-cols-2" aria-label="What changes if you switch">
          {result.featuresLost.length > 0 ? (
            <Card tone="warn">
              <h2 className="text-xl">What you&apos;d give up</h2>
              <ul className="mt-3 grid gap-2">
                {result.featuresLost.map((f) => (
                  <li key={f} className="flex gap-3">
                    <span aria-hidden="true" className="font-bold">
                      –
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {result.featuresGained.length > 0 ? (
            <Card tone="good">
              <h2 className="text-xl">What you&apos;d gain</h2>
              <ul className="mt-3 grid gap-2">
                {result.featuresGained.map((f) => (
                  <li key={f} className="flex gap-3">
                    <span aria-hidden="true" className="font-bold">
                      +
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </section>
      ) : null}

      {result.caveats.length > 0 ? (
        <section className="mt-8" aria-labelledby="notes">
          <h2 id="notes" className="text-xl">
            Good to know
          </h2>
          <ul className="mt-3 grid gap-2 text-[var(--color-ink-soft)]">
            {result.caveats.map((c) => (
              <li key={c} className="flex gap-3">
                <span aria-hidden="true" className="font-bold">
                  i
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="next">
        <h2 id="next" className="text-2xl">
          What would you like to do?
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {switching && rec && product.pricingUrl ? (
            <div>
              <LinkButton
                href={product.pricingUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                variant="primary"
                onClick={() => track("cta_clicked", { product: product.slug, cta: "provider" })}
              >
                Change my plan on {product.companyName}&apos;s website ↗
              </LinkButton>
            </div>
          ) : null}
          {actions}
        </div>
        {switching ? (
          <p className="mt-3 text-[var(--color-ink-soft)]">
            You change plans on the provider&apos;s own website, in your account settings – we never touch your account. Nothing changes unless you decide to.
          </p>
        ) : null}
      </section>

      {(result.monthlyDifference ?? 0) > 0 ? (
        <Card tone="info" className="mt-8">
          <p className="text-xl font-bold">
            <span aria-hidden="true">♥ </span>This check may save you about {formatMoney(result.annualDifference)} a year
          </p>
          <p className="mt-2">
            {SITE_NAME} is free for everyone and run by one person. If it helped, chipping in a few dollars keeps the prices verified and the site free – but it&apos;s
            entirely optional and nothing is locked either way.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <LinkButton href={DONATE_URL || "/support"} target={DONATE_URL ? "_blank" : undefined} rel={DONATE_URL ? "noopener noreferrer" : undefined} variant="secondary" onClick={() => track("donate_clicked", { page: "result" })}>
              {DONATE_URL ? "Support the site ↗" : "How to support the site"}
            </LinkButton>
          </div>
        </Card>
      ) : null}

      <Details summary={`See every ${product.name} plan compared to your answers`}>
        <AllPlansTable product={product} evaluations={result.allPlans} />
      </Details>

      <p className="mt-6 text-[0.95rem] text-[var(--color-ink-soft)]">
        Plan and price information last verified {formatMonthYear(result.dataVerifiedAt)}.{" "}
        {product.pricingUrl ? (
          <>
            Source: <a href={product.pricingUrl} rel="noopener noreferrer nofollow" target="_blank">official {product.companyName} pricing page ↗</a>.
          </>
        ) : null}{" "}
        <Link href={`/plans/${product.slug}`}>More about {product.name} plans</Link>.
      </p>
    </div>
  );
}

function PlanSummary({ title, evaluation, tone, note }: { title: string; evaluation: PlanEvaluation; tone: "default" | "good"; note?: string }) {
  const unmet = evaluation.checks.filter((c) => c.state === "not_met");
  const unknown = evaluation.checks.filter((c) => c.state === "unknown");
  const extras = evaluation.checks.filter((c) => c.state === "unused");
  let fit: { symbol: string; text: string; tone: string };
  if (evaluation.checks.length === 0) fit = { symbol: "", text: "", tone: "" };
  else if (unmet.length > 0) fit = { symbol: "✗", text: `Missing something you need: ${unmet.map((c) => c.featureLabel.toLowerCase()).join(", ")}`, tone: "text-[var(--color-danger)]" };
  else if (unknown.length > 0) fit = { symbol: "?", text: `Probably covers what you need – ${unknown.length === 1 ? "one thing" : `${unknown.length} things`} couldn't be checked`, tone: "text-[var(--color-warn)]" };
  else if (note) fit = { symbol: "✓", text: note, tone: "text-[var(--color-good)]" };
  else if (extras.length > 0) fit = { symbol: "✓", text: "Covers what you need, plus things you said you don't use", tone: "text-[var(--color-good)]" };
  else fit = { symbol: "✓", text: "Covers everything you told us you need", tone: "text-[var(--color-good)]" };
  return (
    <Card tone={tone}>
      <p className="text-[0.95rem] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">{title}</p>
      <p className="mt-1 text-2xl font-bold">{evaluation.plan.name}</p>
      <p className="mt-1 text-xl">
        {evaluation.priceKnown ? (
          <>
            {formatMoney(evaluation.monthlyCost)} <span className="text-[1rem]">a month</span>
          </>
        ) : (
          <span className="text-[1rem]">Price not verified</span>
        )}
      </p>
      {fit.text ? (
        <p className={`mt-3 font-semibold ${fit.tone}`}>
          <span aria-hidden="true">{fit.symbol} </span>
          {fit.text}
        </p>
      ) : null}
    </Card>
  );
}

export function AllPlansTable({ product, evaluations }: { product: ProductDef; evaluations: PlanEvaluation[] }) {
  const features = product.features.filter((f) => f.type !== "info");
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table, scroll sideways to see more">
      <table className="text-[0.95rem]">
        <caption className="sr-only">All {product.name} plans and what they include</caption>
        <thead>
          <tr>
            <th scope="col">Plan</th>
            <th scope="col">Price</th>
            {features.map((f) => (
              <th key={f.key} scope="col">
                {f.label}
              </th>
            ))}
            <th scope="col">Fits your answers?</th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((e) => (
            <tr key={e.plan.slug} className={e.isRecommended ? "bg-[var(--color-good-soft)]" : e.isCurrent ? "bg-[var(--color-brand-soft)]" : ""}>
              <th scope="row">
                {e.plan.name}
                {e.isCurrent ? <span className="block text-[0.85rem] font-normal">(your plan)</span> : null}
                {e.isRecommended && !e.isCurrent ? <span className="block text-[0.85rem] font-normal">(best fit)</span> : null}
                {e.plan.status === "grandfathered" ? <span className="block text-[0.85rem] font-normal">(no longer sold)</span> : null}
              </th>
              <td>{e.priceKnown ? `${formatMoney(e.monthlyCost)}/mo` : "Not verified"}</td>
              {features.map((f) => (
                <td key={f.key}>{formatValue(f, e.plan.features[f.key] ?? null)}</td>
              ))}
              <td>{e.checks.length === 0 ? "—" : e.satisfiesAll ? (e.unknownCount > 0 ? "Probably" : "Yes") : `No – missing ${e.missing.join(", ")}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
