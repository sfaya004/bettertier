import type { Metadata } from "next";
import { Container, PageTitle } from "@/components/ui";
import { Prose } from "@/components/Prose";
import { SITE_NAME, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "About our price checker (BetterTierBot)", description: "How and why our automated price checker visits provider pricing pages.", alternates: { canonical: "/bot" } };

export default function BotPage() {
  return (
    <Container narrow>
      <PageTitle lead="Information for website operators and curious visitors.">About our price checker</PageTitle>
      <Prose>
        <p>
          {SITE_NAME} keeps subscription prices accurate by periodically re-reading the public pricing or help page we originally recorded each plan from. The
          checker identifies itself as <code>BetterTierBot</code> in its user agent and links to this page.
        </p>
        <h2>What it does</h2>
        <ul>
          <li>Visits one public page per provider, at most once a day.</li>
          <li>Reads the visible text and looks for the prices we already have on file.</li>
          <li>If a price is missing or a new one appears, it flags the page for a person to review. It never changes our data by itself.</li>
        </ul>
        <h2>What it does not do</h2>
        <ul>
          <li>It respects <code>robots.txt</code>. If a site disallows it, that provider is switched to manual checking.</li>
          <li>It never signs in, creates accounts, submits forms, bypasses CAPTCHAs or other protections, or stores page content beyond a short text snippet used as evidence.</li>
          <li>It does not crawl. It requests only the specific pages we recorded, with a delay between requests.</li>
        </ul>
        <h2>Contact</h2>
        <p>
          If you operate a website and would prefer we check it differently or not at all, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we
          will switch that site to manual checking.
        </p>
      </Prose>
    </Container>
  );
}
