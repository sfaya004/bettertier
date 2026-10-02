import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageTitle, LinkButton } from "@/components/ui";
import { SITE_NAME, SITE_URL, jsonLd } from "@/lib/site";

export const metadata: Metadata = {
  title: "Help & frequently asked questions",
  description: `How ${SITE_NAME} works, where the prices come from, and what the results mean.`,
  alternates: { canonical: "/help" },
};

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: `What does ${SITE_NAME} do?`,
    a: `You tell us which subscription you pay for and answer a few simple questions about how you use it. We compare your answers with every plan the same company currently sells and tell you whether your plan fits, whether a cheaper plan would do, or whether you're missing something you need.`,
  },
  {
    q: "Do I need an account?",
    a: "No. You can check as many subscriptions as you like without signing up. An account only adds one thing: it keeps your list of checked subscriptions so you can see it from another device.",
  },
  {
    q: "Do you need my Netflix, Google or bank password?",
    a: "Never. We don't connect to any of your accounts. If a website claiming to be us asks for a password or card number, close it.",
  },
  {
    q: "Where do the prices come from?",
    a: (
      <>
        Every plan is recorded from the provider&apos;s own pricing or help page, and each plan page shows the source link and the date we last verified it. An automated
        checker re-reads those pages regularly and flags anything that looks different so a person can review it. <Link href="/bot">More about our price checker</Link>.
      </>
    ),
  },
  {
    q: "What do the results mean?",
    a: (
      <ul className="mt-2 grid gap-2">
        <li>
          <strong>✓ Good fit</strong> – every cheaper plan is missing something you said you need.
        </li>
        <li>
          <strong>$ May be paying for more than you need</strong> – a cheaper plan covers everything you told us you use.
        </li>
        <li>
          <strong>! May be missing something you need</strong> – your current plan doesn&apos;t include something you said you need.
        </li>
        <li>
          <strong>? Needs a closer look</strong> – the answer depends on something you weren&apos;t sure about, or on which plan you have.
        </li>
        <li>
          <strong>? Couldn&apos;t verify</strong> – we couldn&apos;t confirm a price from official pages, so we won&apos;t guess.
        </li>
      </ul>
    ),
  },
  {
    q: "Why didn't you just recommend the cheapest plan?",
    a: "Because the cheapest plan is only a good deal if it does what you need. If you said two people watch at the same time and the cheapest plan only allows one, recommending it would cost you a feature you use. We only suggest plans that cover everything you told us.",
  },
  {
    q: "What if I don't know which plan I have?",
    a: "Choose “I'm not sure”. We'll show you the plan that fits your answers and explain where to look in your account to find your current plan. Every question also has an “I'm not sure” answer – we never eliminate a plan based on something you weren't sure about.",
  },
  {
    q: "Are the savings guaranteed?",
    a: "No. They're estimates based on the answers you gave and the prices the provider publishes. Taxes, promotions, bundles and add-ons can change your actual bill. Always check the price on the provider's website before you switch.",
  },
  {
    q: "How do I actually change my plan?",
    a: "On the provider's own website or app, usually under Account, Membership, Subscription or Billing. We link to the right place where we can. We never change anything for you.",
  },
  {
    q: "How does this site make money?",
    a: (
      <>
        It&apos;s free, and there is no paid version. The site is supported by optional donations, and possibly some unobtrusive advertising later on (never inside
        the check itself). No provider pays us for links or sign-ups, so nothing influences the result. <Link href="/support">How the site is supported</Link>.
      </>
    ),
  },
  {
    q: "My subscription isn't listed. Can you add it?",
    a: (
      <>
        Probably. We add subscriptions based on what people search for. <Link href="/plans">See the current list</Link>, and if yours is missing, we&apos;d like to know.
      </>
    ),
  },
  {
    q: "The text is too small / too large.",
    a: "Use your browser's zoom (hold Ctrl and press + on Windows, or Command and + on a Mac). The site is designed to stay readable at any zoom level.",
  },
];

export default function HelpPage() {
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs
      .filter((f) => typeof f.a === "string")
      .map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a as string } })),
    url: `${SITE_URL}/help`,
  };
  return (
    <Container narrow>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(jsonLdData) }} />
      <PageTitle lead="Short answers to the questions people ask most.">Help</PageTitle>
      <div className="grid gap-3">
        {faqs.map((f) => (
          <details key={f.q} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-5 py-3">
            <summary className="font-semibold text-[1.1rem] min-h-12 flex items-center">{f.q}</summary>
            <div className="mt-3">{f.a}</div>
          </details>
        ))}
      </div>
      <div className="mt-10">
        <LinkButton href="/check">Check my subscription</LinkButton>
      </div>
    </Container>
  );
}
