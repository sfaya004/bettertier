import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import { SITE_NAME, SITE_URL, SITE_TAGLINE, SITE_DESCRIPTION, ANALYTICS_SCRIPT_URL, ANALYTICS_DOMAIN } from "@/lib/site";
import { Container } from "@/components/ui";
import { PageViewBeacon } from "@/components/PageViewBeacon";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} – ${SITE_TAGLINE}`, template: `%s – ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_US" },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never lock zoom – people need to be able to enlarge text.
  maximumScale: 5,
  themeColor: "#0b5c8e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <header className="border-b border-[var(--color-line)] bg-white">
          <Container wide className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
            <Link href="/" className="no-underline text-2xl font-bold text-[var(--color-ink)] hover:text-[var(--color-brand)]" aria-label={`${SITE_NAME} home`}>
              <span aria-hidden="true" className="inline-block mr-2 rounded-md bg-[var(--color-brand)] px-2 text-white">
                ↑
              </span>
              {SITE_NAME}
            </Link>
            <nav aria-label="Main">
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[1.05rem] font-semibold">
                <li>
                  <Link href="/check" className="inline-block py-2">
                    Check a subscription
                  </Link>
                </li>
                <li>
                  <Link href="/my-subscriptions" className="inline-block py-2">
                    My subscriptions
                  </Link>
                </li>
                <li>
                  <Link href="/help" className="inline-block py-2">
                    Help
                  </Link>
                </li>
                <li>
                  <Link href="/account" className="inline-block py-2">
                    My account
                  </Link>
                </li>
                <li>
                  <Link
                    href="/support"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--color-brand)] bg-[var(--color-brand-soft)] px-4 py-2 no-underline text-[var(--color-brand-dark)] hover:bg-[var(--color-brand)] hover:text-white"
                  >
                    <span aria-hidden="true">♥</span> Support this site
                  </Link>
                </li>
              </ul>
            </nav>
          </Container>
        </header>
        <main id="main" className="py-8 sm:py-12">
          {children}
        </main>
        <footer className="mt-16 border-t border-[var(--color-line)] bg-white py-10 text-[0.95rem] text-[var(--color-ink-soft)]">
          <Container>
            <p className="max-w-none">
              {SITE_NAME} compares plans using information from each provider&apos;s official website. Prices and plans change often – always confirm on the
              provider&apos;s site before changing your subscription. Savings shown are estimates based on the answers you give, not guarantees.
            </p>
            <p className="mt-3 max-w-none">
              {SITE_NAME} is free and is supported by optional donations. No provider pays us, and nothing influences which plan we recommend.{" "}
              <Link href="/support">How the site is supported</Link>.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-semibold">
              <li>
                <Link href="/about">About</Link>
              </li>
              <li>
                <Link href="/plans">All plans</Link>
              </li>
              <li>
                <Link href="/help">Help &amp; FAQ</Link>
              </li>
              <li>
                <Link href="/support">Support this site</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/terms">Terms</Link>
              </li>
              <li>
                <Link href="/bot">About our price checker</Link>
              </li>
            </ul>
            <p className="mt-6 max-w-none">
              © {new Date().getFullYear()} {SITE_NAME}. Company and plan names belong to their respective owners and are used only to identify the plans being
              compared. {SITE_NAME} is not affiliated with or endorsed by any provider listed.
            </p>
          </Container>
        </footer>
        <PageViewBeacon />
        {ANALYTICS_SCRIPT_URL ? <Script src={ANALYTICS_SCRIPT_URL} data-domain={ANALYTICS_DOMAIN} strategy="afterInteractive" /> : null}
      </body>
    </html>
  );
}
