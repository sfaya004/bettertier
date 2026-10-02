# Product specification

## Positioning

**BetterTier** — *"You don't have to cancel it. You might just be on the wrong plan."*

A personalized subscription plan optimization platform. Not a price-comparison table, not a cancellation service, not a budgeting app. It answers one question: *based on what I actually need, am I paying for the right plan?*

## Users

Consumers with recurring subscriptions across streaming, music, cloud storage, productivity, AI tools, gaming, VPN/security, password managers, reading, learning, fitness, news and memberships. Explicitly designed for the "non-technical grandparent" (75–85, occasional computer use, reduced eyesight, no jargon) as the bar every screen must clear; technically confident users get the same simple flow plus "see every plan" details on demand.

## Feature list

### MVP (built)
- Subscription search with aliases (e.g. "HBO" → HBO Max) and popular picks; full A–Z browse by category.
- Guided check: plan selection (with prices and "best for"), older/grandfathered plans, **"I'm not sure which plan I have"**, price confirmation with user-entered amount and billing period.
- Dynamic, provider-specific questions generated from structured plan data: one question for every feature that differs between the provider's plans (features identical on all plans are never asked; capped at 8); **"I'm not sure" on every question**; contextual help text; Back button; "Question n of m" progress; refresh-safe.
- Transparent recommendation engine with five statuses; savings/extra cost per month and year; "Why?"; uncertainties to check; features lost/gained; caveats (data age, unverified values, grandfathered plans, annual-billing tip, user-price mismatch); full plan table on demand; source link and last-verified date.
- Multi-subscription dashboard with current vs. potential monthly/annual totals, clearly labelled as estimates; browser storage for guests.
- Optional accounts (email + password) to save the list; account deletion.
- Public catalog pages per provider and head-to-head comparison pages, generated from the same data (SEO).
- Admin dashboard: companies, products, plans, features (question copy), prices with history, sources, FAQs, publish/draft, verification log, change-review queue, monitor controls, aggregate analytics.
- Automated pricing-page monitor with robots.txt compliance, change detection, staleness rule, and human approval; optional AI re-check that extracts prices and feature values from the official page against the product schema, proposes differences with evidence quotes, applies them on approval, and auto re-verifies unchanged products; optional headless-browser rendering for JavaScript pricing pages.
- Landing page, help/FAQ, about, support/donation page, privacy and terms pages, bot information page.
- Aggregate, identifier-free analytics; optional privacy-friendly script hook.
- Security: hashed passwords, hashed session tokens, same-origin checks, rate limits, security headers, SSRF guard, input validation.

### Phase 2 (after validation)
- Free email alerts for saved subscriptions when a plan's price or features change (the saved-subscription model and change detection are already in place); renewal reminders.
- Donation prompts tuned by results (already wired via `NEXT_PUBLIC_DONATE_URL`); unobtrusive display ads on catalog pages once traffic justifies it — never inside the check flow.
- Bundle awareness (Disney+/Hulu/ESPN, Apple One, Google One/AI tiers) and add-on pricing (Netflix extra members, Prime Video ad-free).
- Price-history pages per provider (original SEO content from `price_history`).
- Catalog expansion to 100–150 providers; per-category question templates to speed authoring.
- Redis-backed rate limiting if scaled to multiple instances; Sentry error reporting.

### Phase 3
- Regional pricing (UK/CA/AU) using the existing `regions`/`prices` model.
- Household mode (shared plans, seat counts across services).
- Public dataset/API licensing of the verified catalog; B2B/white-label for credit unions and senior-services organisations.

## User flows

1. **Landing → Check**: hero, one primary CTA. `/check`: search box (results as plain links) or popular tiles.
2. **Plan**: "Which {Provider} plan are you paying for?" → active plans as large buttons, "I'm on an older plan" (collapsed), "I'm not sure" (always last). "How do I find out which plan I have?" collapsible.
3. **Price**: "Is this what you pay?" published price ± annual; "Yes" / "No, I pay a different amount" → amount + frequency; "Skip" available. Skipped when the plan is unknown or unpriced.
4. **Questions**: one per screen; "Question n of about m"; options as large buttons; help under the question; Back removes the last answer. Ends automatically when no remaining question could change the outcome.
5. **Result**: status badge + headline + one-sentence summary → savings card (if any) → current vs. fitting plan cards → Why? → Before you decide (uncertainties) → What you'd give up / gain → Good to know → What would you like to do? (provider link opens in a new tab; dashboard; check another; change answers) → support card when savings were found ("this may save you $X a year… chipping in keeps the site free – entirely optional") → full plan table (collapsed) → source & date. A "♥ Support this site" link sits in the header of every page. No popups or interstitials anywhere.
6. **Dashboard**: totals, table, remove/check again, save to account (signed in) or create account.
7. **Account**: sign up/in (email preserved after errors), saved list, sign out, delete account (type DELETE).

## Recommendation engine (`src/lib/engine`)

**Data model.** `ProductDef { features[], plans[] }`. Feature types: `number` (need ≥ X), `boolean` (need it or not), `ordinal` (ordered levels), `info` (display only). Plan values may be `null` (= not verified).

**Question selection (`nextQuestion`).** Relevant features = those (by `sort_order`) whose value differs between at least two shoppable plans (active + the user's own grandfathered plan). Every relevant feature is asked, in order, up to 8 — even when the remaining plans already agree — so the result rests on the full picture and the explanation can cover every difference. Options come from the feature's configured `options` (or Yes/No for booleans) + "I'm not sure" (`null`).

**Evaluation (`analyze`).** For each shoppable plan and each answered feature: `met`, `unused` (boolean the user doesn't need but the plan includes), `not_met`, or `unknown` (user unsure or plan value unverified). Candidates = active plans with no `not_met` and a known price, sorted by monthly-equivalent cost (ties: stay on current plan, then lower tier). `recommended` = cheapest candidate.

**Status.**
- `over_subscribed`: recommended is cheaper than the current cost → savings = current − recommended (user-entered price used for current if given; mismatch explained).
- `good_fit`: current satisfies everything and no cheaper plan does; reasons list what each cheaper plan lacks.
- `under_subscribed`: current has a `not_met` → recommend the cheapest plan that covers everything, with the extra cost.
- `needs_review`: current plan unknown, or an "I'm not sure" answer concerns a feature on which current and recommended differ (surfaced in "Before you decide"); or single-plan product with unknown current plan.
- `unable_to_verify`: current (or recommended) plan has no verified price — no savings claimed.

**Never invents.** Unverified values → `unknown`, shown as "we couldn't verify". Data older than 120 days → caveat. Grandfathered plan → warning about not being able to return. Annual billing cheaper than 12× monthly → tip.

**Money.** Monthly-equivalent = monthly price, else annual/12, else weekly×52/12. Annual difference = monthly difference × 12. All figures labelled estimates.

## Data verification system

See `docs/DATA-UPDATES.md`. Summary: every product carries source URLs + `last_verified_at` + `verification_status`; the daily monitor snapshots pricing pages, detects missing/new prices, flags unreadable pages and stale products; admins approve/reject with evidence; verification events are logged; users always see the verification date.

## Non-goals (deliberately)

No paid tier or paywall, no bank linking, no provider passwords, no cancellation flows, no numeric "scores", no dark patterns (no pre-selected upsells, no urgency, no hidden buttons), no ads in the check flow, no guarantees of savings.
