import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, Container, PageTitle, inputClass } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { loadUserSubscriptions } from "@/lib/subscriptions";
import { deleteAccount, deleteSavedSubscription, signOut } from "./actions";
import { formatMoney } from "@/lib/engine/format";
import { STATUS_LABELS } from "@/lib/engine/analyze";
import { Badge } from "@/components/ui";

export const metadata: Metadata = { title: "My account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/account/sign-in?next=/account");
  const { error } = await searchParams;
  const items = await loadUserSubscriptions(user.id);

  return (
    <Container narrow>
      <PageTitle lead={`Signed in as ${user.email}`}>My account</PageTitle>
      {user.role === "admin" ? (
        <p className="mb-8 rounded-[var(--radius-md)] border-2 border-[var(--color-info)] bg-[var(--color-info-soft)] p-4 font-semibold">
          You are an administrator. <Link href="/admin">Open the admin dashboard →</Link>
        </p>
      ) : null}

      <h2 className="text-2xl">Saved subscriptions</h2>
      {items.length === 0 ? (
        <p className="mt-2">
          Nothing saved yet. <Link href="/my-subscriptions">Go to My subscriptions</Link> and choose “Save these to my account”.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {items.map((i) => {
            const s = STATUS_LABELS[i.status];
            return (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
                <div>
                  <p className="font-bold">
                    {i.productName} <span className="font-normal text-[var(--color-ink-soft)]">· {i.currentPlanName}</span>
                  </p>
                  <p className="mt-1">
                    <Badge tone={s.tone} symbol={s.symbol}>
                      {s.label}
                    </Badge>{" "}
                    {i.monthlyDifference && i.monthlyDifference > 0 ? <span className="ml-2">Could save {formatMoney(i.monthlyDifference)}/mo</span> : null}
                  </p>
                </div>
                <form action={deleteSavedSubscription}>
                  <input type="hidden" name="id" value={i.id.replace("acct-", "")} />
                  <Button variant="danger" type="submit">
                    Remove
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4">
        <Link href="/my-subscriptions">See totals and estimated savings →</Link>
      </p>

      <h2 className="mt-12 text-2xl">Sign out</h2>
      <form action={signOut} className="mt-3">
        <Button variant="secondary" type="submit">
          Sign out
        </Button>
      </form>

      <h2 className="mt-12 text-2xl">Delete my account</h2>
      <Card tone="danger" className="mt-3">
        <p>This permanently deletes your account and everything saved in it. It cannot be undone.</p>
        {error === "confirm" ? (
          <p role="alert" className="mt-2 font-semibold">
            Please type DELETE (in capitals) to confirm.
          </p>
        ) : null}
        <form action={deleteAccount} className="mt-4">
          <label htmlFor="confirm" className="block font-semibold">
            Type DELETE to confirm
          </label>
          <input id="confirm" name="confirm" className={`${inputClass} mt-2 max-w-xs`} autoComplete="off" />
          <div className="mt-4">
            <Button variant="danger" type="submit">
              Delete my account permanently
            </Button>
          </div>
        </form>
      </Card>
    </Container>
  );
}
