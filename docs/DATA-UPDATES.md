# Keeping subscription data current

The product's value depends on prices being right. This is how data stays current with minimal effort from you.

## The loop

1. **Seed** — `data/catalog/*.json` holds the researched catalog (official sources, checked dates). `npm run db:seed` loads new products; `-- --update` overwrites an existing product from its file (use for a bulk re-research; admin edits to that product are replaced). `-- --text` refreshes only the wording of existing products (feature labels, questions, help text, answer options, plan names/descriptions, FAQs) and leaves prices, statuses and verification untouched – the production container runs this on every deploy, so copy edits in the catalog files go live with the next push.
2. **Monitor (automated, daily)** — `GET /api/cron/monitor` (or `npm run monitor`) visits each published product's official pricing page:
   - checks `robots.txt` first; if disallowed, switches the product to manual mode and queues a note;
   - fetches the page with an identified user agent, 15 s timeout, 2 MB cap, no cookies;
   - extracts every `$x.xx` on the page with surrounding context;
   - **`price_missing`** – a price we have on file no longer appears → queued with evidence;
   - **`price_new`** – a dollar amount appeared that wasn't there last time and isn't a known price → queued with the text around it;
   - **`page_unreadable`** – no prices readable at all (JavaScript-rendered page) → product switched to manual, queued once;
   - **`fetch_failed`** – two consecutive failures → queued;
   - **`stale`** – any published product not verified within 120 days → queued.
   It never edits catalog data itself.
3. **Review (you, a few minutes a week)** — `/admin/changes` lists pending items with evidence and a link to the official page. Open the page, update the plan price/features if needed (`/admin/plans/:id`), then **Approve** (reviewed) or **Reject** (false alarm). Approving a `stale` item marks the product verified today. On the company page, "I checked the official page – mark verified today" records a verification and clears stale flags.
4. **Publish** — users always see "Plan and price information last verified <date>" and a link to the source. Products older than 120 days additionally show a "please double-check" caveat in results.

## AI re-check of prices *and* features (recommended)

Set `ANTHROPIC_API_KEY` (and optionally `AI_MODEL`, `AI_RECHECK_DAYS`, `AI_AUTO_CONFIRM`) and the monitor gains a second pass: for each product due (default: every 7 days), the official page's text is given to Claude together with the product's plan slugs and feature schema. The model must return only values explicitly stated on the page, each with a verbatim quote, or `null`. The result is diffed against the catalog:

- `ai_price` – a stated price differs from ours → queued with the quote; **Approve & apply** updates the price and logs price history.
- `ai_feature` – a stated feature value differs (e.g. simultaneous streams 4 → 3) → same, applies to the plan's feature value.
- `ai_discontinued` – the page says a plan is no longer sold → applying marks it grandfathered.
- `ai_new_plan` / `ai_plan_missing` – informational; add or retire the plan in the plan editor.
- No differences, high confidence, ≥80 % of catalog values positively confirmed → the product is marked **verified today** by `ai-monitor` and any stale flags are resolved. Turn this off with `AI_AUTO_CONFIRM=false` if you prefer to click yourself.

A page that is silent about something never overrides the catalog; the model never sees anything except the official page and your schema. Cost: about 10k tokens per page — roughly $0.50 for all 47 on Haiku 4.5, so weekly is ~$2/month. Force a run any time with `npm run monitor -- --ai`, the "Force AI re-check now" box on `/admin/monitor`, or `/api/cron/monitor?ai=1`.

### JavaScript-only pricing pages

Set a product's monitor mode to **render** and the monitor fetches the page with a headless Chromium (Playwright) before reading it, which makes many client-rendered pricing pages readable by both the price check and the AI re-check. This needs Playwright installed where the monitor runs (`npx playwright install chromium`) — fine on your PC or a VPS, not available in the slim Docker image by default. It still honours robots.txt, identifies itself, and never signs in or clicks anything.

## What is realistic to automate, honestly

The research pass found that many providers render prices with JavaScript or block automated readers (Netflix help center, Hulu, Disney+, Paramount+, YouTube, Xbox marketing pages, Proton, McAfee, LastPass, NYT, Amazon). For those, the monitor will report "page unreadable" or a fetch failure once and switch to **manual mode**; the `stale` rule then guarantees they resurface for a human check every 120 days. Static help-center pages (HBO Max, Peacock, Spotify, Apple, Microsoft, Adobe, 1Password, Bitwarden, Norton, Costco, Strava, Grammarly) monitor well.

Tips that increase automatic coverage: point `pricingUrl` at a **help-center article** ("Plans and pricing") rather than a marketing page — these are usually plain HTML; and add the newsroom/press page as a second `source`.

Not done, by design: bypassing CAPTCHAs, headless-browser rendering of sites that block bots, logging in, or scraping third-party aggregators. If a provider asks us to stop, set the product to manual mode (the `/bot` page tells them how to reach you).

## Adding a subscription

**Option A – JSON file (recommended for many at once):** copy an existing file in `data/catalog/`, keep the same structure, run `npm run db:seed`. The seed publishes automatically when at least half the active plans have verified prices; otherwise it stays a draft.

**Option B – admin UI:** `/admin/companies` → "Add a new subscription" (creates a draft) → add features (with question text and answer options) → add plans → fill prices and feature values → add sources and FAQs → set status to Published.

### Writing good features (this is the question system)

- Only add a feature if it **differs between plans** or shoppers ask about it. Identical-everywhere features are never asked about anyway.
- `number`: user needs at least X (people, GB, devices, credits). Give 3–4 `options` in plain words: `{"label":"Just me","value":1}`.
- `boolean`: included or not. No options needed (Yes / No / Not sure are generated).
- `ordinal`: ordered levels lowest→highest (`["hd","full_hd","4k"]`) with `levelLabels` and `options`.
- `info`: displayed in tables, never asked.
- `sort_order` decides question order; put the most decisive feature first so fewer questions are needed.
- Write for an 80-year-old: no jargon in labels, questions or help.

## Regional pricing

`regions` + `prices.region_code` are in place. To add a region: insert a row in `regions`, add prices for that region, and pass `region` to `getProductDef` from a locale-aware route (e.g. `/uk/plans/netflix`). The engine is region-agnostic — it just receives the prices it is given.
