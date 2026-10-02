# BetterTier

**Live site:** [bettertier.com](https://bettertier.com)

BetterTier is a free web app that tells people whether the subscription plan they pay for (Netflix, Spotify, Microsoft 365, ChatGPT and 40+ others) actually fits what they use. It compares the user's current plan with every plan the same provider sells, based on a few plain-English questions, and never simply recommends the cheapest option.

Designed, built and operated by Samon Fayaz using AI-assisted development (Claude Code).

> **Portfolio copy.** This repository is shared so the code can be reviewed. It is not licensed for reuse; see [LICENSE](LICENSE). Configuration, deployment and operational details have been removed.

## What it does

1. **Choose a subscription**: search or pick a popular one.
2. **Pick your plan**: large buttons with prices, plus "I'm not sure."
3. **Confirm what you pay**: the published price, or the amount on your bill.
4. **Answer a few questions**: only about features that differ between that provider's plans, and every question has an "I'm not sure" option.
5. **Get a clear result**: whether the plan is a good fit, the estimated monthly and yearly difference, why, what you would give up, and the source and date the pricing was checked.

## Technical highlights

- **Stack:** Next.js (App Router), TypeScript, React, SQLite via libSQL with Drizzle ORM, Tailwind CSS.
- **Recommendation engine:** pure TypeScript and unit-tested. It picks the least expensive plan that meets every known requirement and never rules out a plan based on unverified data.
- **Structured catalog:** 47 subscriptions in `data/catalog/`, each with plans, features, prices, official source links and verification dates. Unverifiable values are stored as unknown rather than guessed.
- **Automated price monitoring with a human gate:** a monitor re-reads official pricing pages, queues any differences for review, and changes nothing until an admin approves.
- **Accessibility first:** large type, high contrast, large controls, full keyboard and screen-reader support, and automated WCAG 2.2 AA checks.
- **Privacy by design:** no cookies, no third-party analytics, no stored IP addresses, and guest mode keeps answers in the browser.
- **Testing:** Vitest unit tests (engine, monitor parsing, URL safety, privacy of traffic counting) and Playwright end-to-end tests with axe accessibility checks.

## Repository layout

```
data/catalog/       subscription catalog (plans, features, prices, sources)
drizzle/            SQL migrations
src/db/             schema, connection, migrate and seed scripts
src/lib/engine/     recommendation engine
src/lib/monitor/    pricing-page monitor
src/app/            Next.js pages and routes
src/components/     UI components
e2e/                Playwright and accessibility tests
docs/               architecture, database, data updates, product spec, SEO, testing
```

## Documentation

- [docs/PRODUCT-SPEC.md](docs/PRODUCT-SPEC.md): features, user flows, recommendation logic
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack decisions and system design
- [docs/DATABASE.md](docs/DATABASE.md): schema and migrations
- [docs/DATA-UPDATES.md](docs/DATA-UPDATES.md): how prices stay current
- [docs/TESTING.md](docs/TESTING.md): what was tested and the results
- [docs/SEO.md](docs/SEO.md): page architecture and structured data
