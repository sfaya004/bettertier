# SEO

## Page architecture

| URL | Purpose | Caching |
|---|---|---|
| `/` | Landing; WebSite JSON-LD with SearchAction | ISR 1h |
| `/plans` | Index of every published subscription by category | ISR 1h |
| `/plans/{provider}` | Provider page: current plans & prices, what differs, head-to-head links, FAQ (FAQPage JSON-LD), sources, related providers, CTA to the interactive check; BreadcrumbList | ISR 1h |
| `/plans/{provider}/{a}-vs-{b}` | Adjacent-tier comparison: exact deltas, "same on both", who should pick which; canonical order enforced with a 308 redirect | ISR 1h |
| `/help`, `/about`, `/pricing`, legal pages | Support & trust content; help has FAQPage JSON-LD | static |
| `/check`, `/check/{provider}` | Interactive tool | `/check/*` is `noindex` (personalised state) and disallowed in robots.txt; `/check` itself is indexable |

Targets (from the research): "netflix plans", "which netflix plan should i get", "spotify premium vs free", "google one plans", "chatgpt plus vs pro", "microsoft 365 personal vs family", "xbox game pass tiers", "nordvpn plans", "{service} premium vs basic".

## Quality guardrails (Google's 2026 scaled-content policy)

- Every page is built from **verified structured facts** (prices, features, sources, dates) plus provider-specific copy (`bestFor`, FAQ, notes), not templated filler.
- Only adjacent-tier comparison pages are generated (n−1 per provider), not every pair × persona. Total at launch: 43 provider pages + ~90 comparison pages.
- Drafts (unverified prices) are excluded from the site and sitemap.
- Each page carries a unique title/description, breadcrumb, canonical, "last verified" date and source links.

## Technical

- `sitemap.xml` (dynamic, ISR) lists static pages, provider pages (lastmod = verification date) and comparison pages.
- `robots.txt` allows all, disallows `/admin`, `/api/`, `/account`, `/my-subscriptions`, `/check/`.
- Metadata: `metadataBase`, per-page `title`/`description`/`canonical`, OpenGraph site name; viewport allows zoom up to 5×.
- JSON-LD: WebSite+SearchAction (home), BreadcrumbList (provider & comparison pages), FAQPage (provider pages with FAQs, help page). Serialised with `<` escaped.
- Core Web Vitals: no client JS on content pages except the tiny event ping; system font stack (no font requests); ~106 kB shared JS; no layout shift sources (no images, fixed-size controls).
- Provider outbound links use `rel="noopener noreferrer nofollow"` and open in a new tab (labelled ↗).

## Internal linking

Home → popular checks + `/plans`; `/plans` → every provider; provider → comparisons, related providers in the same category, check; comparison → provider, check; result page → provider page and source; footer → all plans, help, legal, bot.

## Next steps after launch

Submit the sitemap in Google Search Console and Bing Webmaster Tools; watch which provider pages earn impressions and prioritise expanding those categories; add price-history pages (Phase 2) as original content.
