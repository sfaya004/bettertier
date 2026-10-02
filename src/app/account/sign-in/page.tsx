import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container, PageTitle } from "@/components/ui";
import { AuthForm } from "@/components/AuthForm";
import { signIn } from "../actions";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/account");
  const { next } = await searchParams;
  return (
    <Container narrow>
      <PageTitle lead="Sign in to see the subscriptions you saved.">Sign in</PageTitle>
      <AuthForm mode="sign-in" action={signIn} next={next} />
    </Container>
  );
}
