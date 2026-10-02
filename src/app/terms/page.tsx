import type { Metadata } from "next";
import { Container, PageTitle } from "@/components/ui";
import { Prose, DraftNotice } from "@/components/Prose";
import { SITE_NAME, LEGAL_ENTITY, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of use", description: `The terms for using ${SITE_NAME}.`, alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <Container narrow>
      <PageTitle lead="Last updated September 2026">Terms of use</PageTitle>
      <DraftNotice what="terms document" />
      <Prose>
        <p>
          These terms govern your use of {SITE_NAME}, operated by {LEGAL_ENTITY} (“we”). By using the site you agree to them. If you don&apos;t agree, please
          don&apos;t use the site.
        </p>
        <h2>What {SITE_NAME} is – and isn&apos;t</h2>
        <p>
          {SITE_NAME} is an information tool. It compares subscription plans using information we record from providers&apos; public web pages and the answers you
          give. It is not financial, legal or professional advice, and it is not a substitute for checking the provider&apos;s current terms and prices yourself.
        </p>
        <h2>Accuracy</h2>
        <p>
          Providers change prices, plans and features frequently, sometimes without notice, and prices can vary by region, promotion, bundle and tax. We work to
          keep our information current and we show when it was last verified, but <strong>we do not guarantee that any price, feature or availability is accurate
          or current</strong>. Savings figures are estimates based on your answers. Always confirm details with the provider before changing or cancelling a
          subscription.
        </p>
        <h2>Your responsibilities</h2>
        <ul>
          <li>Decisions about your subscriptions are yours. We are not responsible for any charges, losses or lost features that result from changing a plan.</li>
          <li>Keep your account password secure and tell us if you think it has been compromised.</li>
          <li>Don&apos;t misuse the site: no scraping at scale, no attempts to disrupt it, no unlawful use.</li>
        </ul>
        <h2>How the site is funded</h2>
        <p>{SITE_NAME} is free and is supported by optional donations. Donations are voluntary, are not payment for any service, and do not change what you can use. No provider pays us for links or recommendations.</p>
        <h2>Trademarks and third-party content</h2>
        <p>
          Company, product and plan names are trademarks of their respective owners and are used solely to identify the plans being compared. {SITE_NAME} is not
          affiliated with, sponsored by or endorsed by any provider listed.
        </p>
        <h2>Our content</h2>
        <p>The site&apos;s design, text and software are ours or our licensors&apos;. You may use the site for personal, non-commercial purposes. Factual pricing information itself is not something we claim ownership of.</p>
        <h2>Accounts</h2>
        <p>You may delete your account at any time. We may suspend accounts that violate these terms.</p>
        <h2>Disclaimer and limitation of liability</h2>
        <p>
          THE SITE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND. TO THE FULLEST EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL,
          CONSEQUENTIAL OR SPECIAL DAMAGES, OR FOR ANY LOSS ARISING FROM RELIANCE ON INFORMATION ON THE SITE. OUR TOTAL LIABILITY FOR ANY CLAIM IS LIMITED TO THE
          AMOUNT YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM (WHICH MAY BE ZERO).
        </p>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms; the date above shows the current version. Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Prose>
    </Container>
  );
}
