import type { Metadata } from "next";
import { Container, PageTitle } from "@/components/ui";
import { Dashboard } from "@/components/Dashboard";
import { getSessionUser } from "@/lib/auth";
import { loadUserSubscriptions } from "@/lib/subscriptions";

export const metadata: Metadata = {
  title: "My subscriptions",
  description: "All the subscriptions you've checked, with your estimated monthly and yearly savings.",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function MySubscriptionsPage() {
  const user = await getSessionUser();
  const serverItems = user ? await loadUserSubscriptions(user.id) : [];
  return (
    <Container>
      <PageTitle lead="Everything you've checked, in one place.">My subscriptions</PageTitle>
      <Dashboard signedIn={Boolean(user)} serverItems={serverItems} />
    </Container>
  );
}
