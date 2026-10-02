# Testing — what was run and the results (21 Sep 2026)

## Automated

| Suite | Command | Result |
|---|---|---|
| Unit — recommendation engine (`src/lib/engine/engine.test.ts`) | `npm test` | **21/21 pass** — question selection & progressive disclosure, "I'm not sure" handling, over/under-subscribed, good fit, needs review, user-entered price (monthly & annual), unable to verify, unverified plan values never eliminate, stale data caveat, single-plan products, annual-billing tip, free plans, formatting |
| Unit — monitor extraction & URL safety | `npm test` | **6/6 pass** — HTML→text, price extraction with context, absurd-value filtering, missing/new price diff, SSRF guard |
| Unit — traffic-counting privacy (`src/lib/pageviews.test.ts`) | `npm test` | **4/4 pass** — path normalisation drops queries and excludes /admin, /api, /account; referrer reduced to host and own site ignored; device and bot detection; visitor hash is 16 chars, stable within a day, different across days and IPs, never contains the IP |
| Unit — AI re-check (`src/lib/monitor/ai.test.ts`) | `npm test` | **7/7 pass** — prompt forbids prior knowledge and lists schema; tolerant JSON parsing; diff proposes only explicit differences and never overwrites with nulls; discontinued/missing plans; confirmation counting; injected-model pipeline; clear error on non-JSON |
| Lint / types | `npm run lint`, `npm run typecheck` | clean |
| Production build | `npm run build` | clean; 106 kB shared JS; catalog pages ISR |
| E2E + accessibility (Playwright + axe-core, desktop Chrome + Pixel 7 emulation) | `npm run test:e2e` | **42 pass, 2 skipped (desktop-only keyboard/zoom tests on mobile)** — includes an admin "Approve & apply" test that inserts an AI price proposal, applies it through the UI, checks the catalog, price history and public page, then restores |
| Integration — AI re-check with a stubbed model and a fake official page | ad hoc script | Netflix fixture with a raised Standard price and reduced Premium streams produced exactly two proposals (`ai_price` 19.99→20.99, `ai_feature` streams 4→3) with page quotes, confirmed 12/18 values, ignored the already-grandfathered Basic plan |

E2E coverage: landing → search → plan → price → 4 questions → result → dashboard (desktop + mobile); "I'm not sure" path never blocks; Back restores the previous question; keyboard-only plan selection with focus management; no horizontal overflow on result (mobile); plan and comparison pages render with canonical, JSON-LD and sources; friendly 404; **axe WCAG 2.0/2.1/2.2 A+AA with zero serious/critical violations** on 11 page types including the result page; touch targets ≥ 44 px; 200% text zoom without overflow; sign-up → save list → sign-out → wrong password → sign-in → delete account; admin blocked for normal users; admin price edit → history → public page updated → restore; draft publish/unpublish round-trip; changes and monitor pages.

Manual API checks: analyze (over-subscribed Netflix Premium → Standard, $7/mo, $84/yr), cross-origin POST rejected (403), malformed body (400), unknown product (404), cron without secret (401), cron with secret runs the monitor (Netflix help center returned HTTP 403 to the bot — handled gracefully, no false change queued), security headers present, robots/sitemap correct.

Container simulation: assembled the production container runtime (standalone server + bundled tools) and booted it: migrations → seed (47 products) → admin creation → server ready, `/api/health` ok. (Docker daemon unavailable in the build sandbox, so `docker build` itself was not executed; the Dockerfile mirrors the validated steps.)

## Edge cases exercised

Missing pricing (Google One 200 GB plan, Netflix Basic → "price not verified" / `unable_to_verify`), unknown features (`null` plan values → "couldn't verify"), free plans (Spotify/ChatGPT Free → real $0 candidates), annual-only plans (1Password, ExpressVPN → monthly-equivalent), monthly + annual (billing tip), promotional pricing (stored in notes only), discontinued/grandfathered plans (Netflix Basic, Adobe Photography 20 GB, Audible Plus → selectable under "older plan", warned about), incorrect user-entered price (mismatch caveat, user value used for savings), single-plan products (Apple TV+, Kindle Unlimited), taxes (stated as pre-tax everywhere), multiple currencies/regions (schema-level only; US seeded).

## Issues found and fixed during testing

1. Primary buttons rendered with invisible text — global `a { color }` outranked Tailwind utilities → base styles moved into `@layer base`.
2. Initial focus not moved after hydration → keyboard test failed → fixed focus effect (and stopped stealing focus on first paint).
3. Scrollable tables not keyboard-reachable (axe `scrollable-region-focusable` on mobile) → `tabIndex=0` + labelled region.
4. After a wrong password the email field was cleared (React 19 form reset) → server action echoes the email back.
5. "Unlimited" sentinel (999) collided with 999 GB storage → formatter fixed.
6. Date-only verification dates displayed one day early in US time zones → UTC formatting for calendar dates.
7. Result page repeated the "Why?" list inside the plan cards → cards simplified to a one-line fit summary.
8. Bundled seed script never ran (entry guard only matched `.ts/.js`) → guard fixed.
9. Dev server stuck on "Loading…" — CSP blocked `eval()` that Next.js needs for hot reloading → `'unsafe-eval'` allowed in development only.
10. Multi-button review form: React dropped the clicked button's name/value from the server-action form data, so every decision acted as "approve" → each button now binds its decision via `formAction`.

## Not covered / known limitations

- Screen readers were verified via semantics (roles, labels, live regions, focus order, axe) rather than a live NVDA/VoiceOver session — do one pass before launch.
- The rate limiter is in-memory (single instance).
- `docker build` not executed in this environment (see above).
- No load test; SQLite + ISR comfortably exceeds the launch traffic, see ARCHITECTURE.md scalability notes.
