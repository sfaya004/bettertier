"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AnalysisResult, Answers, BillingPeriod, FeatureValue, ProductDef } from "@/lib/engine/types";
import { nextQuestion, optionsFor, plannedQuestionCount, monthlyEquivalent, formatMoney } from "@/lib/engine";
import { Button, Card, ChoiceButton, Details, Field, LinkButton, inputClass } from "./ui";
import { ResultView } from "./ResultView";
import { clearProgress, loadProgress, saveProgress, upsertAnalysis, track } from "@/lib/store";

type Step = "plan" | "price" | "questions" | "result";

interface FlowState {
  step: Step;
  currentPlan: string | null | undefined; // undefined = not chosen yet, null = "not sure"
  userPrice: number | null;
  userPeriod: BillingPeriod;
  answers: Answers;
  askedOrder: string[];
}

const initial: FlowState = { step: "plan", currentPlan: undefined, userPrice: null, userPeriod: "monthly", answers: {}, askedOrder: [] };

export function CheckFlow({ product }: { product: ProductDef }) {
  const [state, setState] = useState<FlowState>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Restore progress after a refresh.
  useEffect(() => {
    const saved = loadProgress<FlowState>(product.slug);
    if (saved && saved.step !== "result") setState(saved);
    setHydrated(true);
  }, [product.slug]);

  useEffect(() => {
    if (hydrated) saveProgress(product.slug, state);
  }, [state, hydrated, product.slug]);

  // Move keyboard/screen-reader focus to the new question each step (not on first paint).
  const interacted = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (!interacted.current) {
      interacted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [hydrated, state.step, state.askedOrder.length]);

  const activePlans = product.plans.filter((p) => p.status === "active");
  const olderPlans = product.plans.filter((p) => p.status === "grandfathered");
  const currentPlanDef = state.currentPlan ? product.plans.find((p) => p.slug === state.currentPlan) ?? null : null;
  const catalogMonthly = currentPlanDef ? monthlyEquivalent(currentPlanDef) : null;

  const question = state.step === "questions" ? nextQuestion(product, state.answers, state.currentPlan ?? null) : null;
  const totalPlanned = plannedQuestionCount(product, state.currentPlan ?? null);

  const runAnalysis = useCallback(
    async (answers: Answers, currentPlan: string | null, userPrice: number | null, userPeriod: BillingPeriod) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ product: product.slug, currentPlan, userPrice, userPeriod, answers }),
        });
        const data = (await res.json()) as { result?: AnalysisResult; error?: string };
        if (!res.ok || !data.result) throw new Error(data.error ?? "Something went wrong.");
        setResult(data.result);
        setState((s) => ({ ...s, step: "result" }));
        clearProgress(product.slug);
        upsertAnalysis({
          product: product.slug,
          productName: product.name,
          currentPlan,
          currentPlanName: data.result.currentPlan?.plan.name ?? "Not sure",
          userPrice,
          userPeriod,
          answers,
          status: data.result.status,
          headline: data.result.headline,
          currentMonthlyCost: data.result.currentMonthlyCost,
          recommendedPlan: data.result.recommendedPlan?.plan.slug ?? null,
          recommendedPlanName: data.result.recommendedPlan?.plan.name ?? null,
          recommendedMonthlyCost: data.result.recommendedMonthlyCost,
          monthlyDifference: data.result.monthlyDifference,
          annualDifference: data.result.annualDifference,
        });
        track("comparison_completed", { product: product.slug, status: data.result.status });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [product.slug, product.name],
  );

  // When no more questions remain, run the analysis automatically.
  useEffect(() => {
    if (state.step === "questions" && question === null && !loading && !result && !error) {
      void runAnalysis(state.answers, state.currentPlan ?? null, state.userPrice, state.userPeriod);
    }
  }, [state, question, loading, result, error, runAnalysis]);

  function choosePlan(slug: string | null) {
    track("subscription_analyzed", { product: product.slug });
    const plan = slug ? product.plans.find((p) => p.slug === slug) : null;
    const hasPrice = plan ? monthlyEquivalent(plan) !== null : false;
    setState((s) => ({ ...s, currentPlan: slug, step: slug && hasPrice ? "price" : "questions", userPrice: null }));
  }

  function answer(key: string, value: FeatureValue) {
    setState((s) => ({ ...s, answers: { ...s.answers, [key]: value }, askedOrder: [...s.askedOrder, key] }));
  }

  function goBack() {
    setError(null);
    setState((s) => {
      if (s.step === "price") return { ...s, step: "plan" };
      if (s.step === "questions") {
        if (s.askedOrder.length === 0) {
          const hasPrice = currentPlanDef ? monthlyEquivalent(currentPlanDef) !== null : false;
          return { ...s, step: s.currentPlan && hasPrice ? "price" : "plan" };
        }
        const last = s.askedOrder[s.askedOrder.length - 1];
        const rest = { ...s.answers };
        delete rest[last];
        return { ...s, answers: rest, askedOrder: s.askedOrder.slice(0, -1) };
      }
      return s;
    });
  }

  function startOver() {
    setResult(null);
    setError(null);
    clearProgress(product.slug);
    setState(initial);
  }

  if (!hydrated) return <p aria-busy="true">Loading…</p>;

  /* ---------- RESULT ---------- */
  if (state.step === "result" && result) {
    return (
      <ResultView
        result={result}
        product={product}
        actions={
          <>
            <LinkButton href="/my-subscriptions" variant="secondary">
              See all my subscriptions
            </LinkButton>
            <LinkButton href="/check" variant="secondary">
              Check another subscription
            </LinkButton>
            <Button variant="quiet" onClick={startOver}>
              Change my answers
            </Button>
          </>
        }
      />
    );
  }

  /* ---------- STEP: PLAN ---------- */
  if (state.step === "plan") {
    return (
      <div>
        <p className="font-semibold text-[var(--color-ink-soft)]">Step 2 of 3 · Your plan</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl sm:text-4xl outline-none">
          Which {product.name} plan are you paying for?
        </h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">Pick the one on your bill. If you&apos;re not sure, that&apos;s fine – choose the last option.</p>
        <div className="mt-6 grid gap-3">
          {activePlans.map((p) => {
            const m = monthlyEquivalent(p);
            return (
              <ChoiceButton key={p.slug} onClick={() => choosePlan(p.slug)} description={m !== null ? `${formatMoney(m)} a month${p.bestFor ? ` · ${p.bestFor}` : ""}` : p.bestFor ?? "Price not verified"}>
                {p.name}
              </ChoiceButton>
            );
          })}
          {olderPlans.length > 0 ? (
            <Details summary="I'm on an older plan that isn't listed">
              <div className="grid gap-3">
                {olderPlans.map((p) => (
                  <ChoiceButton key={p.slug} onClick={() => choosePlan(p.slug)} description="No longer sold to new customers">
                    {p.name}
                  </ChoiceButton>
                ))}
              </div>
            </Details>
          ) : null}
          <ChoiceButton onClick={() => choosePlan(null)} description="We'll show you the plan that fits your answers, and how to find your current plan.">
            I&apos;m not sure which plan I have
          </ChoiceButton>
        </div>
        {product.planHelp ? (
          <Details summary="How do I find out which plan I have?">
            <p>{product.planHelp}</p>
          </Details>
        ) : null}
        <p className="mt-8">
          <Link href="/check">← Choose a different subscription</Link>
        </p>
      </div>
    );
  }

  /* ---------- STEP: PRICE ---------- */
  if (state.step === "price" && currentPlanDef) {
    return (
      <PriceStep
        headingRef={headingRef}
        planName={currentPlanDef.name}
        productName={product.name}
        catalogMonthly={catalogMonthly}
        annual={currentPlanDef.prices.find((p) => p.period === "annual" && p.amount !== null)?.amount ?? null}
        onConfirm={(price, period) => setState((s) => ({ ...s, userPrice: price, userPeriod: period, step: "questions" }))}
        onBack={goBack}
      />
    );
  }

  /* ---------- STEP: QUESTIONS ---------- */
  if (state.step === "questions") {
    if (question === null) {
      return (
        <div>
          {error ? (
            <Card tone="danger">
              <p className="font-bold">We couldn&apos;t finish the comparison.</p>
              <p className="mt-2">{error}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={() => runAnalysis(state.answers, state.currentPlan ?? null, state.userPrice, state.userPeriod)}>Try again</Button>
                <Button variant="secondary" onClick={goBack}>
                  Go back
                </Button>
              </div>
            </Card>
          ) : (
            <p aria-busy="true" role="status" className="text-xl">
              Comparing your answers with every {product.name} plan…
            </p>
          )}
        </div>
      );
    }
    const number = state.askedOrder.length + 1;
    return (
      <div>
        <p className="font-semibold text-[var(--color-ink-soft)]">
          Step 3 of 3 · Question {number} of {Math.max(totalPlanned, number)}
        </p>
        <div className="mt-2 h-2 w-full rounded-full bg-[var(--color-line)]" aria-hidden="true">
          <div className="h-2 rounded-full bg-[var(--color-brand)]" style={{ width: `${Math.min(100, (number / Math.max(totalPlanned, number)) * 100)}%` }} />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="mt-5 text-3xl sm:text-4xl outline-none">
          {question.question}
        </h1>
        {question.help ? <p className="mt-3 text-[var(--color-ink-soft)]">{question.help}</p> : null}
        <div className="mt-6 grid gap-3">
          {optionsFor(question).map((o) => (
            <ChoiceButton key={String(o.value)} onClick={() => answer(question.key, o.value)}>
              {o.label}
            </ChoiceButton>
          ))}
        </div>
        <div className="mt-8">
          <Button variant="quiet" onClick={goBack}>
            ← Back
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

function PriceStep({
  headingRef,
  planName,
  productName,
  catalogMonthly,
  annual,
  onConfirm,
  onBack,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  planName: string;
  productName: string;
  catalogMonthly: number | null;
  annual: number | null;
  onConfirm: (price: number | null, period: BillingPeriod) => void;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div>
      <p className="font-semibold text-[var(--color-ink-soft)]">Step 2 of 3 · Your plan</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl sm:text-4xl outline-none">
        Is this what you pay for {productName} {planName}?
      </h1>
      <p className="mt-4 text-2xl font-bold">
        {formatMoney(catalogMonthly)} <span className="text-lg font-semibold">a month</span>
        {annual !== null ? <span className="block text-lg font-normal text-[var(--color-ink-soft)]">or {formatMoney(annual)} a year if paid yearly</span> : null}
      </p>
      <p className="mt-2 text-[var(--color-ink-soft)]">This is the current published price, before tax. Your bill may look a little different.</p>
      {!editing ? (
        <div className="mt-6 grid gap-3">
          <ChoiceButton onClick={() => onConfirm(null, "monthly")}>Yes, that&apos;s about right</ChoiceButton>
          <ChoiceButton onClick={() => setEditing(true)} description="Tell us the amount on your bill and we'll use that for your savings estimate.">
            No, I pay a different amount
          </ChoiceButton>
        </div>
      ) : (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(amount.replace(/[$,\s]/g, ""));
            if (!Number.isFinite(n) || n < 0 || n > 10000) {
              setErr("Please enter a number like 15.99");
              return;
            }
            onConfirm(n, period);
          }}
        >
          <Field id="amount" label="How much do you pay?" hint="Look at your most recent bill or bank statement." error={err ?? undefined}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">
                  $
                </span>
                <input id="amount" inputMode="decimal" className={`${inputClass} pl-9 text-xl`} value={amount} onChange={(e) => setAmount(e.target.value)} aria-describedby="amount-hint" autoFocus />
              </div>
              <select aria-label="How often you pay" className={`${inputClass} sm:w-56`} value={period} onChange={(e) => setPeriod(e.target.value as BillingPeriod)}>
                <option value="monthly">every month</option>
                <option value="annual">every year</option>
                <option value="weekly">every week</option>
              </select>
            </div>
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Use this amount</Button>
            <Button variant="secondary" onClick={() => onConfirm(null, "monthly")}>
              Skip – use the published price
            </Button>
          </div>
        </form>
      )}
      <div className="mt-8">
        <Button variant="quiet" onClick={onBack}>
          ← Back
        </Button>
      </div>
    </div>
  );
}
