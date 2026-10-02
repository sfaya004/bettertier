/** Site-wide constants. Change the name/URL here and in .env, nowhere else. */
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "BetterTier";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_TAGLINE = "Are you paying for the right subscription?";
export const SITE_DESCRIPTION =
  "Tell us what you actually use, and we'll compare your current plan against the other plans from the same provider – so you can see whether you're paying for features you don't need.";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@example.com";
export const LEGAL_ENTITY = process.env.NEXT_PUBLIC_LEGAL_ENTITY ?? SITE_NAME;
export const ANALYTICS_SCRIPT_URL = process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL ?? "";
export const ANALYTICS_DOMAIN = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN ?? "";
/** Optional donation link (Ko-fi, Buy Me a Coffee, GitHub Sponsors, PayPal…). Empty = donation prompts are hidden. */
export const DONATE_URL = process.env.NEXT_PUBLIC_DONATE_URL ?? "";

/** Date-only strings ("2026-09-21") are calendar dates, so format them in UTC to avoid off-by-one-day errors. */
function tz(iso: string): { timeZone?: string } {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? { timeZone: "UTC" } : {};
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "not yet verified";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", ...tz(iso) });
}

export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return "not yet verified";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", ...tz(iso) });
}

/** Serialize JSON for a <script type="application/ld+json"> block without allowing "</script>" breakouts. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
