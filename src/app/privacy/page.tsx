import type { Metadata } from "next";
import { Container, PageTitle } from "@/components/ui";
import { Prose, DraftNotice } from "@/components/Prose";
import { SITE_NAME, LEGAL_ENTITY, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy", description: `What ${SITE_NAME} collects, what it doesn't, and your choices.`, alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <Container narrow>
      <PageTitle lead="Last updated September 2026">Privacy policy</PageTitle>
      <DraftNotice what="privacy policy" />
      <Prose>
        <h2>The short version</h2>
        <ul>
          <li>You can use {SITE_NAME} without an account. Your answers stay in your own browser unless you choose to save them to an account.</li>
          <li>We never ask for, or store, passwords for other services, card numbers or bank logins.</li>
          <li>We keep aggregate usage counts (for example “how many Netflix comparisons ran today”) and anonymous records of the answers given, with no personal identifiers.</li>
          <li>We do not sell personal information and do not use advertising trackers.</li>
        </ul>

        <h2>Who we are</h2>
        <p>
          {SITE_NAME} is operated by {LEGAL_ENTITY} (“we”). Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>What we collect and why</h2>
        <h3>Using the site without an account</h3>
        <p>
          The subscriptions you check and the answers you give are stored in your browser&apos;s local storage so your list survives a page refresh. They are sent
          to our server only for the moment it takes to calculate a result, and are not stored there. Clearing your browser data removes them.
        </p>
        <h3>If you create an account</h3>
        <p>
          We store your email address, a securely hashed password, and the subscription checks you choose to save (service, plan, the amount you told us you pay,
          your answers and the result). We use this to show you your list and, if you opt in, to email you when a plan you saved changes price. You can delete
          individual items or your whole account at any time from the account page; deletion is immediate and permanent.
        </p>
        <h3>Aggregate usage statistics</h3>
        <p>
          We record counts of events such as “comparison completed” together with the service involved and the result category. These records contain no IP
          address, account identifier, or browser fingerprint.
        </p>
        <p>
          We also count page views ourselves, without cookies and without any third-party analytics service. When you view a page, our server records the page
          address, the website that referred you (if any), the kind of device (phone, tablet or computer) and the date. To count how many different people visit
          in a day, it combines your IP address and browser type with a secret that changes every day and keeps only a shortened, one-way hash of the result.
          Your IP address is never stored, the hash cannot be turned back into you, and because the secret changes daily it cannot be used to follow you from
          one day to the next. If your browser sends a “Do Not Track” or Global Privacy Control signal, we do not count your visit at all.
        </p>
        <h3>Anonymous answer data</h3>
        <p>
          When a comparison completes we keep an anonymous record of it: which subscription and plan was checked, the answers given, the amount typed if any,
          and the result, together with the calendar date. This record contains no account identifier, session, IP address, browser details or time of day, and
          we do not combine it with any other data, so it cannot be linked back to you. We use these records to improve the questions and the catalog, to
          publish aggregate insights (for example, &quot;most Netflix users who checked were on a higher tier than they needed&quot;), and we may share or license
          the anonymous dataset to others. Because it is anonymous, it is not personal information under CCPA/CPRA or GDPR; if you would rather not contribute,
          simply do not complete a comparison.
        </p>

        <h3>Server logs</h3>
        <p>Our hosting provider keeps standard, short-lived server logs (including IP addresses) for security and reliability. We use IP addresses in memory to limit abusive request rates; they are not written to our database.</p>

        <h2>Cookies</h2>
        <p>
          We set one cookie, and only when you sign in: a session cookie that keeps you signed in. We do not use advertising or cross-site tracking cookies. Because
          we set no non-essential cookies, no cookie banner is required; if that changes, we will ask for consent first.
        </p>

        <h2>Sharing</h2>
        <p>
          We share personal information only with the service providers that host the site and send our emails, and only as needed to run {SITE_NAME}. When you
          click a link to a provider&apos;s website, that provider&apos;s own privacy policy applies; we do not pass them any personal information.
        </p>

        <h2>Your rights</h2>
        <p>
          Wherever you live, you can ask us to show, correct, export or delete the personal information we hold about you by emailing us or using the account page.
          Residents of California (CCPA/CPRA), the EU/UK (GDPR) and other jurisdictions with privacy laws have specific rights, including the right not to be
          discriminated against for exercising them. We do not “sell” or “share” personal information as those terms are defined in the CPRA.
        </p>

        <h2>Data retention</h2>
        <p>Account data is kept until you delete it. Aggregate event counts and anonymous answer records are kept indefinitely because they contain no personal information. Server logs are kept by our hosting provider for a limited period.</p>

        <h2>Children</h2>
        <p>{SITE_NAME} is not directed at children under 13 and we do not knowingly collect information from them.</p>

        <h2>Changes</h2>
        <p>We will post any changes here and update the date at the top. Significant changes affecting account holders will be emailed.</p>
      </Prose>
    </Container>
  );
}
