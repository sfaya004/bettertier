/**
 * Run the pricing-page monitor from the command line.
 *
 *   npm run monitor                 -> all published products
 *   npm run monitor -- netflix      -> one product
 *   npm run monitor -- --ai         -> force the AI re-check for every product now (needs ANTHROPIC_API_KEY)
 *
 * Findings are queued in the admin "Changes" page; nothing is changed automatically.
 */
import { runMonitor } from "../lib/monitor/run";

const args = process.argv.slice(2);
const ai = args.includes("--ai") ? true : undefined;
const slug = args.find((a) => !a.startsWith("--"));
runMonitor({ productSlug: slug, ai })
  .then((r) => {
    console.log(`Checked ${r.checked}, skipped ${r.skipped}, queued ${r.changesCreated} change(s), AI re-checked ${r.aiChecked}, auto re-verified ${r.aiConfirmed}.`);
    for (const d of r.details) console.log(`  ${d.product.padEnd(26)} ${d.outcome}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
