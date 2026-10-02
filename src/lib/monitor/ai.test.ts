import { describe, it, expect } from "vitest";
import { buildPrompt, countConfirmed, diffExtraction, parseExtraction, recheckWithAI } from "./ai";
import type { ProductDef } from "@/lib/engine/types";

const product: ProductDef = {
  slug: "netflix",
  name: "Netflix",
  companyName: "Netflix",
  category: "streaming-video",
  features: [
    { key: "simultaneous_streams", label: "Streams", type: "number", sortOrder: 0 },
    { key: "video_quality", label: "Quality", type: "ordinal", levels: ["full_hd", "4k"], sortOrder: 1 },
    { key: "ad_free", label: "No ads", type: "boolean", sortOrder: 2 },
    { key: "catalog_notes", label: "Notes", type: "info", sortOrder: 3 },
  ],
  plans: [
    { slug: "standard", name: "Standard", tier: 1, status: "active", confidence: "verified", prices: [{ period: "monthly", amount: 19.99, currency: "USD" }], features: { simultaneous_streams: 2, video_quality: "full_hd", ad_free: true } },
    { slug: "premium", name: "Premium", tier: 2, status: "active", confidence: "verified", prices: [{ period: "monthly", amount: 26.99, currency: "USD" }], features: { simultaneous_streams: 4, video_quality: "4k", ad_free: true } },
  ],
};

const modelJson = JSON.stringify({
  plans: [
    { planSlug: "standard", nameOnPage: "Standard", monthlyPrice: 20.99, annualPrice: null, features: { simultaneous_streams: 2, video_quality: "full_hd", ad_free: true }, evidence: { monthlyPrice: "Standard: $20.99/month", simultaneous_streams: "Watch on 2 supported devices at a time" } },
    { planSlug: "premium", nameOnPage: "Premium", monthlyPrice: 26.99, annualPrice: null, features: { simultaneous_streams: 4, video_quality: null, ad_free: "true" }, evidence: { monthlyPrice: "Premium: $26.99/month" } },
    { planSlug: null, nameOnPage: "Premium Ultra", monthlyPrice: 34.99, annualPrice: null, features: { simultaneous_streams: 6 }, evidence: { monthlyPrice: "Premium Ultra $34.99" } },
  ],
  missingPlans: [],
  notes: "",
  confidence: "high",
});

describe("AI re-check", () => {
  it("builds a prompt that forbids prior knowledge and lists schema", () => {
    const { system, user } = buildPrompt(product, "page text");
    expect(system).toMatch(/Never use prior knowledge/);
    expect(user).toMatch(/slug "standard"/);
    expect(user).toMatch(/"video_quality"/);
    expect(user).not.toMatch(/catalog_notes/);
  });

  it("parses loosely formatted model output", () => {
    const ex = parseExtraction("Here you go:\n```json\n" + modelJson + "\n```");
    expect(ex.plans).toHaveLength(3);
    expect(ex.plans[0].monthlyPrice).toBe(20.99);
    expect(ex.confidence).toBe("high");
  });

  it("proposes only explicit differences, never overwrites with nulls", () => {
    const changes = diffExtraction(product, parseExtraction(modelJson));
    const kinds = changes.map((c) => `${c.kind}:${c.planSlug ?? "-"}:${c.field ?? "-"}`);
    expect(kinds).toContain("ai_price:standard:price:monthly");
    expect(kinds).toContain("ai_new_plan:-:-");
    // premium video_quality was null on page -> no proposal; ad_free "true" string normalizes to boolean -> equal
    expect(kinds.filter((k) => k.startsWith("ai_feature"))).toEqual([]);
    const price = changes.find((c) => c.kind === "ai_price")!;
    expect(price.oldValue).toBe("19.99");
    expect(price.newValue).toBe("20.99");
    expect(price.evidence).toMatch(/\$20\.99/);
  });

  it("flags discontinued and missing plans", () => {
    const ex = parseExtraction(JSON.stringify({ plans: [{ planSlug: "standard", nameOnPage: "Standard", monthlyPrice: null, annualPrice: null, features: {}, evidence: {}, discontinued: true }], missingPlans: ["premium"], notes: "", confidence: "medium" }));
    const changes = diffExtraction(product, ex);
    expect(changes.map((c) => c.kind).sort()).toEqual(["ai_discontinued", "ai_plan_missing"]);
  });

  it("counts confirmations for auto re-verification", () => {
    const { confirmed, total } = countConfirmed(product, parseExtraction(modelJson));
    // total = 2 prices + 6 feature values = 8; confirmed = premium price + standard 3 features + premium streams + premium ad_free = 6
    expect(total).toBe(8);
    expect(confirmed).toBe(6);
  });

  it("runs the pipeline with an injected model", async () => {
    const r = await recheckWithAI(product, "text", async () => modelJson);
    expect(r.changes.length).toBe(2);
    expect(r.extraction.plans[2].planSlug).toBeNull();
  });

  it("throws a clear error on non-JSON output", () => {
    expect(() => parseExtraction("I cannot help with that")).toThrow(/no JSON/);
  });
});
