import { describe, it, expect } from "vitest";
import { extractPrices, htmlToText, priceAppears, summarizeDiff } from "./extract";

describe("monitor extraction", () => {
  it("strips scripts and tags", () => {
    const t = htmlToText("<html><script>var x='$1.00'</script><style>.a{}</style><div>Standard <b>$19.99</b>/mo &amp; Premium $26.99</div></html>");
    expect(t).toBe("Standard $19.99 /mo & Premium $26.99");
  });
  it("finds prices with context", () => {
    const found = extractPrices("Standard with ads $8.99 per month. Standard $19.99. Premium $ 26.99 per month. Cap $1,250.");
    expect(found.map((f) => f.amount)).toEqual([8.99, 19.99, 26.99, 1250]);
    expect(found[0].context).toMatch(/Standard with ads/);
  });
  it("ignores absurd amounts", () => {
    expect(extractPrices("$0 and $99999").map((f) => f.amount)).toEqual([]);
  });
  it("detects missing and new prices", () => {
    const prev = extractPrices("$8.99 $19.99");
    const next = extractPrices("$8.99 $20.99");
    expect(priceAppears(next, 19.99)).toBe(false);
    expect(summarizeDiff(prev, next)).toEqual({ added: [20.99], removed: [19.99] });
    expect(summarizeDiff(null, next)).toEqual({ added: [], removed: [] });
  });
});
