"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/engine/format";
import { STATUS_LABELS } from "@/lib/engine/analyze";
import { listAnalyses, removeAnalysis, type SavedAnalysis } from "@/lib/store";
import { Badge, Button, Card, LinkButton } from "./ui";

export function Dashboard({ signedIn, serverItems }: { signedIn: boolean; serverItems: SavedAnalysis[] }) {
  const [items, setItems] = useState<SavedAnalysis[] | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    // Account items win over browser items for the same product.
    const local = listAnalyses();
    const merged = [...serverItems];
    for (const l of local) if (!merged.some((s) => s.product === l.product)) merged.push(l);
    setItems(merged);
  }, [serverItems]);

  if (items === null) return <p aria-busy="true">Loading your subscriptions…</p>;

  if (items.length === 0) {
    return (
      <Card>
        <p className="text-xl font-bold">You haven&apos;t checked any subscriptions yet.</p>
        <p className="mt-2 text-[var(--color-ink-soft)]">Check one and it will appear here, along with your estimated savings.</p>
        <div className="mt-5">
          <LinkButton href="/check">Check my first subscription</LinkButton>
        </div>
      </Card>
    );
  }

  const current = items.reduce((sum, i) => sum + (i.currentMonthlyCost ?? 0), 0);
  const potential = items.reduce((sum, i) => sum + (i.recommendedMonthlyCost ?? i.currentMonthlyCost ?? 0), 0);
  const diff = Math.round((current - potential) * 100) / 100;

  async function saveToAccount() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: listAnalyses() }),
      });
      if (!res.ok) throw new Error();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div>
      <Card tone={diff > 0 ? "good" : "default"}>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="font-semibold text-[var(--color-ink-soft)]">You currently pay about</dt>
            <dd className="text-2xl font-bold">{formatMoney(current)} a month</dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--color-ink-soft)]">With the plans that fit your answers</dt>
            <dd className="text-2xl font-bold">{formatMoney(potential)} a month</dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--color-ink-soft)]">Estimated difference</dt>
            <dd className="text-2xl font-bold">
              {diff > 0 ? `${formatMoney(diff)} a month` : diff < 0 ? `${formatMoney(Math.abs(diff))} more a month` : "No change"}
              {diff !== 0 ? <span className="block text-lg">{formatMoney(Math.abs(diff) * 12)} a year</span> : null}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-[var(--color-ink-soft)]">
          These are estimates based on your answers and published prices. They are not guaranteed savings. Prices and plans can change at any time.
        </p>
      </Card>

      <div className="mt-8 overflow-x-auto" tabIndex={0} role="region" aria-label="Table, scroll sideways to see more">
        <table>
          <caption className="sr-only">Your checked subscriptions</caption>
          <thead>
            <tr>
              <th scope="col">Service</th>
              <th scope="col">Result</th>
              <th scope="col" className="text-right">
                You pay
              </th>
              <th scope="col" className="text-right">
                Plan that fits
              </th>
              <th scope="col" className="text-right">
                Difference
              </th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const s = STATUS_LABELS[i.status];
              return (
                <tr key={i.id}>
                  <th scope="row">
                    <Link href={`/check/${i.product}`} className="font-bold">
                      {i.productName}
                    </Link>
                    <span className="block text-[0.9rem] font-normal text-[var(--color-ink-soft)]">{i.currentPlanName}</span>
                  </th>
                  <td>
                    <Badge tone={s.tone} symbol={s.symbol}>
                      {s.label}
                    </Badge>
                  </td>
                  <td className="text-right whitespace-nowrap">{i.currentMonthlyCost !== null ? `${formatMoney(i.currentMonthlyCost)}/mo` : "—"}</td>
                  <td className="text-right whitespace-nowrap">
                    {i.recommendedPlanName ?? "—"}
                    {i.recommendedMonthlyCost !== null ? <span className="block text-[0.9rem]">{formatMoney(i.recommendedMonthlyCost)}/mo</span> : null}
                  </td>
                  <td className="text-right whitespace-nowrap font-semibold">
                    {i.monthlyDifference === null ? "—" : i.monthlyDifference > 0 ? `Save ${formatMoney(i.monthlyDifference)}/mo` : i.monthlyDifference < 0 ? `+${formatMoney(Math.abs(i.monthlyDifference))}/mo` : "No change"}
                  </td>
                  <td>
                    <div className="flex flex-col gap-2">
                      <Link href={`/check/${i.product}`}>Check again</Link>
                      <button
                        type="button"
                        className="text-left underline text-[var(--color-danger)]"
                        onClick={() => {
                          removeAnalysis(i.id);
                          setItems((prev) => (prev ?? []).filter((x) => x.id !== i.id));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <LinkButton href="/check">Check another subscription</LinkButton>
        {signedIn ? (
          <Button variant="secondary" onClick={saveToAccount} disabled={saveState === "saving"}>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved to your account ✓" : "Save these to my account"}
          </Button>
        ) : (
          <LinkButton href="/account/sign-up" variant="secondary">
            Create a free account to keep this list
          </LinkButton>
        )}
      </div>
      {saveState === "error" ? (
        <p role="alert" className="mt-3 font-semibold text-[var(--color-danger)]">
          We couldn&apos;t save right now. Please try again in a moment.
        </p>
      ) : null}
      <p className="mt-4 text-[var(--color-ink-soft)]">
        {signedIn ? "Your list is stored in your account." : "Your list is stored only in this browser. Clearing your browser data will remove it."}
      </p>
    </div>
  );
}
