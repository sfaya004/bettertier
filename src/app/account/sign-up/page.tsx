import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container, PageTitle } from "@/components/ui";
import { AuthForm } from "@/components/AuthForm";
import { signUp } from "../actions";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create a free account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const user = await getSessionUser();
  if (user) redirect("/account");
  return (
    <Container narrow>
      <PageTitle lead="An account keeps your list of checked subscriptions so you can see it from any device. It's free, and you don't need one to use the site.">
        Create a free account
      </PageTitle>
      <AuthForm mode="sign-up" action={signUp} />
      <p className="mt-6 text-[var(--color-ink-soft)]">We only ask for an email and a password. We never ask for card numbers or the passwords to your other subscriptions.</p>
    </Container>
  );
}
