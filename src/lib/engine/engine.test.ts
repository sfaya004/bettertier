import { describe, it, expect } from "vitest";
import { analyze, nextQuestion, optionsFor, relevantFeatures, monthlyEquivalent, formatValue, plannedQuestionCount } from "./index";
import type { ProductDef } from "./types";

const netflix: ProductDef = {
  slug: "netflix",
  name: "Netflix",
  companyName: "Netflix",
  category: "streaming-video",
  pricingUrl: "https://help.netflix.com/en/node/24926",
  planHelp: "Go to Account.",
  lastVerifiedAt: "2026-09-21",
  features: [
    { key: "simultaneous_streams", label: "People who can watch at the same time", type: "number", question: "How many people watch at the same time?", options: [{ label: "Just one", value: 1 }, { label: "2", value: 2 }, { label: "3 or 4", value: 4 }], sortOrder: 0 },
    { key: "video_quality", label: "Picture quality", type: "ordinal", levels: ["full_hd", "4k"], levelLabels: { full_hd: "Full HD", "4k": "4K" }, question: "What picture quality?", options: [{ label: "Full HD", value: "full_hd" }, { label: "4K", value: "4k" }], sortOrder: 1 },
    { key: "ad_free", label: "No advertisements", type: "boolean", question: "No ads?", sortOrder: 2 },
    { key: "downloads", label: "Downloads", type: "boolean", question: "Downloads?", sortOrder: 3 },
    { key: "extra_member_slots", label: "Extra members", type: "number", question: "Extra members?", options: [{ label: "0", value: 0 }, { label: "1", value: 1 }, { label: "2", value: 2 }], sortOrder: 4 },
  ],
  plans: [
    { slug: "standard-with-ads", name: "Standard with ads", tier: 1, status: "active", confidence: "verified", prices: [{ period: "monthly", amount: 8.99, currency: "USD" }], features: { simultaneous_streams: 2, video_quality: "full_hd", ad_free: false, downloads: true, extra_member_slots: 0 } },
    { slug: "standard", name: "Standard", tier: 2, status: "active", confidence: "verified", prices: [{ period: "monthly", amount: 19.99, currency: "USD" }], features: { simultaneous_streams: 2, video_quality: "full_hd", ad_free: true, downloads: true, extra_member_slots: 1 } },
    { slug: "premium", name: "Premium", tier: 3, status: "active", confidence: "verified", prices: [{ period: "monthly", amount: 26.99, currency: "USD" }], features: { simultaneous_streams: 4, video_quality: "4k", ad_free: true, downloads: true, extra_member_slots: 2 } },
    { slug: "basic", name: "Basic", tier: 2, status: "grandfathered", confidence: "uncertain", prices: [{ period: "monthly", amount: null, currency: "USD" }], features: { simultaneous_streams: 1, video_quality: null, ad_free: true, downloads: true, extra_member_slots: 0 } },
  ],
};

describe("question selection (progressive disclosure)", () => {
  it("never asks about a feature that is identical on every plan", () => {
    const keys = relevantFeatures(netflix).map((f) => f.key);
    expect(keys).not.toContain("downloads");
    expect(keys).toEqual(["simultaneous_streams", "video_quality", "ad_free", "extra_member_slots"]);
  });

  it("asks every distinguishing feature, even when only one plan could already fit", () => {
    // Needs 4 streams -> only Premium fits, but we still ask the remaining questions for a fuller result
    expect(nextQuestion(netflix, { simultaneous_streams: 4 }, "premium")?.key).toBe("video_quality");
    const all = { simultaneous_streams: 4, video_quality: "4k", ad_free: true, extra_member_slots: 2 };
    expect(nextQuestion(netflix, all, "premium")).toBeNull();
  });

  it("asks questions in the configured order and never repeats one", () => {
    const q = nextQuestion(netflix, { simultaneous_streams: 1, video_quality: "full_hd", ad_free: true }, "premium");
    expect(q?.key).toBe("extra_member_slots");
  });

  it("stops at the question cap", () => {
    const many: ProductDef = {
      ...netflix,
      features: Array.from({ length: 12 }, (_, i) => ({ key: `f${i}`, label: `F${i}`, type: "boolean" as const, question: `Q${i}?`, sortOrder: i })),
      plans: [
        { ...netflix.plans[0], features: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}`, false])) },
        { ...netflix.plans[2], features: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}`, true])) },
      ],
    };
    const answers = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`f${i}`, true]));
    expect(plannedQuestionCount(many, null)).toBe(8);
    expect(nextQuestion(many, answers, null)).toBeNull();
  });

  it("always offers an I'm not sure option", () => {
    const opts = optionsFor(netflix.features[0]);
    expect(opts[opts.length - 1]).toEqual({ label: "I'm not sure", value: null });
    const boolOpts = optionsFor(netflix.features[2]);
    expect(boolOpts.map((o) => o.value)).toEqual([true, false, null]);
  });

  it("caps the planned question count", () => {
    expect(plannedQuestionCount(netflix, "premium")).toBe(4);
  });
});

describe("analyze", () => {
  it("flags over-subscription and computes savings", () => {
    const r = analyze({ product: netflix, currentPlanSlug: "premium", answers: { simultaneous_streams: 1, video_quality: "full_hd", ad_free: true, extra_member_slots: 0 } });
    expect(r.status).toBe("over_subscribed");
    expect(r.recommendedPlan?.plan.slug).toBe("standard");
    expect(r.monthlyDifference).toBe(7);
    expect(r.annualDifference).toBe(84);
    expect(r.featuresLost.join(" ")).toMatch(/4K|Picture quality/);
    expect(r.featuresLost.join(" ")).toMatch(/watch at the same time/);
  });

  it("does not recommend the cheapest plan when it lacks a needed feature", () => {
    const r = analyze({ product: netflix, currentPlanSlug: "standard", answers: { simultaneous_streams: 2, video_quality: "full_hd", ad_free: true, extra_member_slots: 0 } });
    expect(r.status).toBe("good_fit");
    expect(r.recommendedPlan?.plan.slug).toBe("standard");
    expect(r.monthlyDifference).toBe(0);
    expect(r.reasons.join(" ")).toMatch(/Standard with ads .* doesn't include No advertisements/);
  });

  it("flags under-subscription when the current plan misses a need", () => {
    const r = analyze({ product: netflix, currentPlanSlug: "standard", answers: { simultaneous_streams: 4, video_quality: "full_hd", ad_free: true } });
    expect(r.status).toBe("under_subscribed");
    expect(r.recommendedPlan?.plan.slug).toBe("premium");
    expect(r.monthlyDifference).toBe(-7);
  });

  it("marks needs_review when an unsure answer decides between plans", () => {
    const r = analyze({ product: netflix, currentPlanSlug: "premium", answers: { simultaneous_streams: 1, video_quality: null, ad_free: true, extra_member_slots: 0 } });
    expect(r.status).toBe("needs_review");
    expect(r.uncertainties.length).toBeGreaterThan(0);
    expect(r.monthlyDifference).toBe(7);
  });

  it("ignores unsure answers that don't matter", () => {
    // downloads is identical everywhere; being unsure about it changes nothing
    const r = analyze({ product: netflix, currentPlanSlug: "standard", answers: { simultaneous_streams: 2, video_quality: "full_hd", ad_free: true, downloads: null, extra_member_slots: 0 } });
    expect(r.status).toBe("good_fit");
  });

  it("handles 'I'm not sure which plan I have'", () => {
    const r = analyze({ product: netflix, currentPlanSlug: null, answers: { simultaneous_streams: 1, video_quality: "full_hd", ad_free: false, extra_member_slots: 0 } });
    expect(r.status).toBe("needs_review");
    expect(r.recommendedPlan?.plan.slug).toBe("standard-with-ads");
    expect(r.uncertainties[0]).toMatch(/How to find your plan/);
  });

  it("uses the user-entered price and explains the difference", () => {
    const r = analyze({ product: netflix, currentPlanSlug: "premium", userPrice: 30, userPeriod: "monthly", answers: { simultaneous_streams: 1, video_quality: "full_hd", ad_free: true, extra_member_slots: 0 } });
    expect(r.usedUserPrice).toBe(true);
    expect(r.currentMonthlyCost).toBe(30);
    expect(r.monthlyDifference).toBe(10.01);
    expect(r.caveats.join(" ")).toMatch(/published price/);
  });

  it("normalizes an annual user price to monthly", () => {
    const r = analyze({ product: netflix, currentPlanSlug: "premium", userPrice: 323.88, userPeriod: "annual", answers: { simultaneous_streams: 4 } });
    expect(r.currentMonthlyCost).toBe(26.99);
    expect(r.status).toBe("good_fit");
  });

  it("returns unable_to_verify when the current plan's price is unknown", () => {
    const r = analyze({ product: netflix, currentPlanSlug: "basic", answers: { simultaneous_streams: 1, ad_free: true } });
    expect(r.status).toBe("unable_to_verify");
    expect(r.caveats.join(" ")).toMatch(/no longer sold/);
  });

  it("never eliminates a plan because of an unverified plan value", () => {
    const r = analyze({ product: netflix, currentPlanSlug: "basic", answers: { video_quality: "4k" } });
    // Basic has null video quality -> unknown, not not_met
    expect(r.currentPlan?.checks[0].state).toBe("unknown");
  });

  it("warns when data is stale", () => {
    const r = analyze({ product: { ...netflix, lastVerifiedAt: "2026-01-01" }, currentPlanSlug: "standard", answers: {}, today: new Date("2026-09-21") });
    expect(r.dataIsStale).toBe(true);
    expect(r.caveats.join(" ")).toMatch(/double-check/);
  });

  it("handles single-plan products", () => {
    const single: ProductDef = { ...netflix, name: "Apple TV+", plans: [netflix.plans[1]], features: [] };
    const r = analyze({ product: single, currentPlanSlug: "standard", answers: {} });
    expect(r.status).toBe("good_fit");
    expect(r.headline).toMatch(/only has one plan/);
  });

  it("suggests annual billing when it is cheaper", () => {
    const withAnnual: ProductDef = {
      ...netflix,
      plans: netflix.plans.map((p) => (p.slug === "standard" ? { ...p, prices: [...p.prices, { period: "annual", amount: 199.99, currency: "USD" }] } : p)),
    };
    const r = analyze({ product: withAnnual, currentPlanSlug: "standard", answers: { simultaneous_streams: 2, ad_free: true } });
    expect(r.caveats.join(" ")).toMatch(/paying for Standard yearly/);
  });

  it("handles free plans (amount 0)", () => {
    const withFree: ProductDef = {
      ...netflix,
      plans: [{ slug: "free", name: "Free", tier: 0, status: "active", confidence: "verified", prices: [{ period: "monthly", amount: 0, currency: "USD" }], features: { simultaneous_streams: 1, video_quality: "full_hd", ad_free: false, downloads: false, extra_member_slots: 0 } }, ...netflix.plans],
    };
    const r = analyze({ product: withFree, currentPlanSlug: "standard-with-ads", answers: { simultaneous_streams: 1, ad_free: false, downloads: false } });
    expect(r.status).toBe("over_subscribed");
    expect(r.recommendedPlan?.plan.slug).toBe("free");
    expect(r.monthlyDifference).toBe(8.99);
  });
});

describe("formatting", () => {
  it("normalizes annual-only prices to monthly", () => {
    expect(monthlyEquivalent({ ...netflix.plans[0], prices: [{ period: "annual", amount: 120, currency: "USD" }] })).toBe(10);
  });
  it("formats unlimited and storage values", () => {
    expect(formatValue({ key: "devices", label: "Devices", type: "number", sortOrder: 0 }, 999)).toBe("Unlimited");
    expect(formatValue({ key: "storage_gb", label: "Storage", type: "number", sortOrder: 0 }, 2000)).toBe("2 TB");
    expect(formatValue({ key: "storage_gb", label: "Storage", type: "number", sortOrder: 0 }, 100)).toBe("100 GB");
    expect(formatValue({ key: "x", label: "x", type: "boolean", sortOrder: 0 }, null)).toBe("Not verified");
  });
});
