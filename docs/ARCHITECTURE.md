# Architecture

## Stack and why

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router, React 19, TypeScript)** | Server rendering for SEO, ISR caching for catalog pages, route handlers for the small JSON API, server actions for admin/auth forms (work without JavaScript, built-in same-origin checks), one deployable unit. |
| Styling | **Tailwind CSS v4** with a small token set in `globals.css` | Fast to build an accessible design system; tokens keep contrast and sizing consistent. No component library — fewer surprises for screen readers. |
| Database | **SQLite via libSQL** (`@libsql/client`) with **Drizzle ORM** | Zero-ops locally (a file), production-ready via a persistent volume or Turso's hosted libSQL (generous free tier). Same SQL dialect everywhere. Typed schema, generated migrations. Read-heavy workload with a small catalog fits SQLite perfectly at 100k visitors/month. |
| Auth | Own minimal implementation: bcrypt password hashes, random session tokens hashed in DB, httpOnly/SameSite cookies | No third-party auth service to pay for or configure; accounts are optional and simple (email + password only). |
| Jobs | `GET /api/cron/monitor` protected by a bearer secret, called from GitHub Actions (or any cron) | Works on every host; no platform-specific scheduler needed. Also runnable via CLI and admin UI. |
| Tests | Vitest (engine), Playwright + axe-core (flow, a11y, mobile, admin) | Engine correctness is the product; a11y is a stated requirement, so it is tested rather than assumed. |
| Hosting | Docker image (Next.js standalone build) | A single container with a persistent volume for the database. |

## System overview

```
                          ┌──────────────────────────┐
  Provider pricing pages ─┤  Monitor (daily cron)     ├─▶ monitor_snapshots
  (robots.txt respected)  │  fetch → extract prices   ├─▶ plan_changes (pending)  ─┐
                          └──────────────────────────┘                             │
                                                                                   ▼
  data/catalog/*.json ──seed──▶  companies / products / plans / features /   ◀── Admin dashboard
                                 plan_features / prices / sources / faqs         (approve, edit, verify, publish)
                                          │
                                          ▼
                     ┌──────────────── catalog.ts (data access, per-request cache) ─────────────┐
                     │                                                                          │
        SEO pages (ISR, 1h)                                     Check flow (client wizard)       │
        /plans, /plans/[slug], /plans/[slug]/[a]-vs-[b]         /check/[slug] → POST /api/analyze ─┘
                                                                     │
                                                                     ▼
                                                        engine/ (pure TS): questions + analyze
                                                                     │
                                                                     ▼
                                       Result → localStorage (guest) / user_subscriptions (account)
```

## Key modules

- `src/lib/engine/` — **recommendation engine**. Pure functions over plain objects (`ProductDef`, `PlanDef`, `FeatureDef`). `questions.ts` implements progressive disclosure; `analyze.ts` produces the full `AnalysisResult` (status, headline, reasons, uncertainties, features lost/gained, savings, caveats). No DB or React imports, so it runs on server and client and is fully unit-tested.
- `src/lib/catalog.ts` — loads products for the engine and pages; wraps queries in React `cache()` so a page render hits the DB once per product. Listing queries are tolerant of a missing DB at build time.
- `src/lib/monitor/` — `fetch.ts` (polite fetch, optional headless rendering, SSRF guard, robots.txt parser), `extract.ts` (HTML → text → prices; unit-tested), `ai.ts` (prompt, Messages-API caller via fetch, strict JSON parsing, pure diff of extracted plan data vs catalog, confirmation counting; unit-tested with an injected model), `run.ts` (orchestration, change dedupe, AI cadence, auto re-verification, snapshot history).
- `src/app/admin/actions.ts` — all catalog mutations as server actions, each guarded by `requireAdmin()`; price edits write `price_history`; every mutation revalidates the affected public pages.
- `src/lib/auth.ts`, `src/lib/ratelimit.ts`, `src/lib/events.ts` — sessions/CSRF, in-memory sliding-window limiter, allow-listed aggregate analytics.

## Rendering & caching strategy

- Static-ish content pages (`/`, `/plans`, `/plans/[slug]`, comparisons, help, legal) use `revalidate = 3600` (ISR). Admin saves call `revalidatePath` so edits go live immediately.
- The check flow page is dynamic (product data is small; the wizard is client-side; results are computed by `POST /api/analyze`).
- Account, dashboard and admin pages are dynamic (cookie-dependent). The root layout deliberately does **not** read cookies so public pages stay cacheable.

## Security model

- All state-changing JSON endpoints call `assertSameOrigin()` (Origin/Sec-Fetch-Site check); server actions rely on Next's built-in origin check.
- Sessions: 32-byte random token, SHA-256 stored, 30-day expiry, `httpOnly`, `SameSite=Lax`, `Secure` in production.
- Passwords: bcrypt cost 12; sign-in does a dummy compare on unknown emails to avoid timing leaks; 10 attempts / 15 min per IP.
- Rate limits on search, analyze, events, subscriptions, auth. In-memory (single instance); swap `rateLimit()` for a Redis-backed version if you scale horizontally.
- Security headers (CSP, HSTS, frame-ancestors none, nosniff, referrer policy, permissions policy) in `next.config.ts`.
- Zod validation on every API body; unknown feature keys/plan slugs are dropped, not trusted.
- Monitor only fetches public http(s) hosts (`isSafePublicUrl`), never private ranges; honours robots.txt; identifies itself; no cookies, no forms, no CAPTCHA circumvention.
- JSON-LD is serialized with `<` escaped so admin-entered FAQ text can't break out of the script tag.
- Admin routes redirect non-admins; cron endpoint requires a constant-time-compared bearer secret.

## Scalability notes (what breaks at 100k visitors/month and what doesn't)

- **Won't break:** SQLite reads (a few queries per page, all indexed); ISR-cached SEO pages; the engine (microseconds per analysis).
- **Watch:** the in-memory rate limiter is per instance — fine on one container; use Redis/Upstash if you run several. The `events` table grows ~1 row per completed check; add a monthly roll-up job or prune after 12 months (trivial `DELETE` in a cron).
- **Monitor runtime:** ~3–5 s per product with politeness delays; 47 products ≈ 3–4 min. The cron calls `?limit=60`; if the catalog grows past ~100, run the monitor in slices (`?limit=40` twice a day) or from a worker with no request timeout (`npm run monitor`).
- **Turso** (if used) adds ~10–30 ms per query from a distant region; keep ISR on and it's invisible to users.
