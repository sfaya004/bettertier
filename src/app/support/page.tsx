import type { Metadata } from "next";
import Link from "next/link";
import { Card, Container, LinkButton, PageTitle } from "@/components/ui";
import { SITE_NAME, DONATE_URL } from "@/lib/site";
import { DonateLink } from "@/components/DonateLink";

export const metadata: Metadata = { title: "Support this site", description: `${SITE_NAME} is free to use. Here's how it's paid for and how you can help if you'd like to.`, alternates: { canonical: "/support" } };
export const dynamic = "force-dynamic";

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ thanks?: string }> }) {
  const { thanks } = await searchParams;
  return (
    <Container narrow>
      {thanks ? (
        <Card tone="good" className="mb-8">
          <p className="text-2xl font-bold">
            <span aria-hidden="true">♥ </span>Thank you!
          </p>
          <p className="mt-2">
            Your support keeps {SITE_NAME} free for everyone and the prices verified. If you ever notice a price that looks wrong, the <Link href="/help">help page</Link> explains how
            the checks work.
          </p>
          <div className="mt-4">
            <LinkButton href="/check" variant="secondary">
              Check another subscription
            </LinkButton>
          </div>
        </Card>
      ) : null}
      <PageTitle lead="Everything here is free, with no account required. It stays that way.">Support this site</PageTitle>
      <Card>
        <h2 className="text-2xl">Free for everyone</h2>
        <p className="mt-2">
          Checking a subscription, seeing the reasoning, saving your list – all of it is free, and there is no paid version. If you find the tool useful, the best
          way to help is to tell someone who might be overpaying.
        </p>
        <div className="mt-5">
          <LinkButton href="/check">Check my subscription</LinkButton>
        </div>
      </Card>
      {DONATE_URL ? (
        <Card tone="info" className="mt-6">
          <h2 className="text-2xl">Buy the site a coffee</h2>
          <p className="mt-2">
            {SITE_NAME} is run by one person. Hosting and keeping 40+ providers&apos; prices verified costs a little every month. If it saved you money and you&apos;d like to
            chip in, thank you – it&apos;s entirely optional and changes nothing about what you can use.
          </p>
          <div className="mt-5">
            <DonateLink href={DONATE_URL} label="Support the site ↗" primary />
          </div>
        </Card>
      ) : null}
      <Card className="mt-6">
        <h2 className="text-2xl">How the site is paid for</h2>
        <p className="mt-2">
          Donations, and – if traffic grows – unobtrusive advertising placed outside the check itself, so it never gets in the way of your result. No provider
          pays us for links, sign-ups or placement, so nothing influences which plan is recommended.
        </p>
      </Card>
    </Container>
  );
}
