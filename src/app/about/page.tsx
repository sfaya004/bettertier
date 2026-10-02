import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageTitle } from "@/components/ui";
import { Prose } from "@/components/Prose";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "About", description: `What ${SITE_NAME} is, who it's for, and how it works.`, alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <Container narrow>
      <PageTitle lead="You don't have to cancel it. You might just be on the wrong plan.">About {SITE_NAME}</PageTitle>
      <Prose>
        <p>
          Most subscription tools help you find and cancel things. {SITE_NAME} answers a different question: <strong>for the subscriptions you want to keep, are you
          paying for the right plan?</strong>
        </p>
        <p>
          Providers sell several tiers of the same service, and the differences are usually small and easy to misjudge – how many people can watch at once, how
          much storage you get, whether there are ads. Many people pick the top plan “to be safe” and never look again. Others pick the cheapest and quietly go
          without something they&apos;d happily pay a few dollars for.
        </p>
        <h2>How it works</h2>
        <p>
          We record every plan a provider currently sells as a set of plain facts, taken from the provider&apos;s official pages. You answer a few questions about
          what you actually use. We check your answers against every plan and show you the least expensive one that covers everything you said you need – plus
          exactly what you&apos;d gain or lose by moving.
        </p>
        <p>
          The result is always explained. We never present a guess as a fact: if we couldn&apos;t verify a price or a feature, we say so and point you to the
          provider&apos;s page instead.
        </p>
        <h2>Designed to be easy</h2>
        <p>
          Large text, plain language, big buttons, an “I&apos;m not sure” answer on every question, and nothing to install or sign up for. If a page here is hard
          to understand, that&apos;s a bug – please tell us.
        </p>
        <h2>Independence</h2>
        <p>
          No provider pays us – not for links, not for sign-ups, not for placement. {SITE_NAME} is supported by optional donations, so the only thing that shapes
          a result is the answers you give. <Link href="/support">How the site is supported</Link>.
        </p>
        <h2>Not affiliated with any provider</h2>
        <p>
          Company and plan names belong to their owners and are used only to identify what is being compared. {SITE_NAME} is not endorsed by or affiliated with
          any provider listed on this site.
        </p>
      </Prose>
    </Container>
  );
}
