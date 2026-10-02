# Database

SQLite/libSQL, managed with Drizzle ORM. Schema source of truth: `src/db/schema.ts`. Migrations live in `drizzle/` and are applied with `npm run db:migrate` (or automatically by the Docker entrypoint).

## Tables

**Catalog**

| Table | Purpose | Notes |
|---|---|---|
| `companies` | Provider identity, category, website, search aliases, affiliate info, **publish status** (`draft`/`published`) | Drafts are invisible to the public site and the sitemap. |
| `products` | The sellable product (1 per company today; supports many) with pricing URL, plan-finding help text, monitor mode, verification status/dates | `monitor_mode` = `auto` (fetch page) / `manual`. |
| `features` | Structured attributes per product: `key`, `label`, `type` (`number`/`boolean`/`ordinal`/`info`), question copy, help, answer `options` (JSON), ordinal `levels` + `level_labels` (JSON), `sort_order` | The question system is configured here — no code changes needed. |
| `plans` | Plan per product: `slug`, `name`, `tier`, `status` (`active`/`grandfathered`/`retired`), `confidence` (`verified`/`uncertain`), `best_for`, `notes`, `seats_included` | |
| `plan_features` | Value of each feature for each plan (JSON-encoded scalar or `null` = not verified) | Unique on (plan, feature). |
| `regions` | Country/currency (`US`/USD seeded) | Architecture point for regional pricing. |
| `prices` | Per plan × region × period (`monthly`/`annual`/`weekly`/`one-time`), `amount` nullable, `is_promo`, notes | Unique on (plan, region, period). |
| `price_history` | Every price change with old/new amount and reason | Written by admin edits. |
| `sources` | Official URLs used for a product, with `checked_at` | Shown on public plan pages. |
| `faqs` | Q&A per product | Rendered + FAQPage JSON-LD. |
| `verifications` | Log of human/seed verifications | Shown in admin. |

**Data maintenance**

| Table | Purpose |
|---|---|
| `monitor_snapshots` | One row per automated fetch: HTTP status, content hash, prices found (JSON), error |
| `plan_changes` | The verification queue: `kind` (`price_missing`, `price_new`, `page_unreadable`, `fetch_failed`, `stale`), evidence, source URL, `status` (`pending`/`approved`/`rejected`), reviewer |
| `settings` | Key/value (e.g. last monitor run report) |

**Anonymous answer dataset**

| Table | Purpose |
|---|---|
| `answer_records` | One row per completed comparison: product, category, current plan (or null for "not sure"), monthly price typed (if any), answers JSON, questions asked, status, recommended plan, monthly difference, calendar day. **No user id, session, IP, user agent or timestamp** — by design, so the dataset can be analysed, published in aggregate or licensed. Export: `/admin/analytics/answers.csv`, `/admin/analytics/answers.jsonl`, or `npm run export-answers` (writes `data/exports/`). |

**Users & analytics**

| Table | Purpose |
|---|---|
| `users` | email, bcrypt hash, `role` (`user`/`admin`), `tier` (`free`/`premium` – Phase 2 billing) |
| `sessions` | hashed session tokens with expiry |
| `user_subscriptions` | Saved analyses per user: product, plan, user price/period, answers (JSON), result summary (JSON) |
| `events` | Aggregate analytics: `name` + allow-listed `props` JSON, no identifiers |

## Conventions

- Timestamps are ISO-8601 strings in UTC. Date-only values (`2026-09-21`) are calendar dates.
- Feature values are JSON so one column holds numbers, booleans and enum strings. `999` in a `number` feature means "unlimited" (rendered as such).
- Foreign keys cascade (`PRAGMA foreign_keys = ON` is set for file databases; Turso enables it by default).

## Changing the schema

1. Edit `src/db/schema.ts`.
2. `npm run db:generate` → creates `drizzle/000X_*.sql`.
3. `npm run db:migrate` locally; commit the migration; deploys apply it on start.

## Backups

- **File DB:** copy `data/bettertier.db` while the app is stopped, or use `sqlite3 data/bettertier.db ".backup backup.db"` (online-safe). The Docker volume `/data` should be snapshotted by your host (Railway/Fly volumes support snapshots) or copied nightly to object storage.
- **Turso:** point-in-time restore is built in on paid plans; free tier – run `turso db shell <db> .dump > backup.sql` from a cron.
- The catalog itself is also in git (`data/catalog/*.json`), so a total loss costs only user accounts and history.
