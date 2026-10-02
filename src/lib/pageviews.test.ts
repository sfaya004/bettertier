import { describe, it, expect } from "vitest";
import { normalisePath, referrerHost, deviceType, isBot, visitorHash } from "./pageviews";

describe("page-view privacy helpers", () => {
  it("normalises paths and drops query strings, trailing slashes and private areas", () => {
    expect(normalisePath("/plans/netflix/?utm=x#top")).toBe("/plans/netflix");
    expect(normalisePath("/")).toBe("/");
    expect(normalisePath("/admin/analytics")).toBeNull();
    expect(normalisePath("/api/health")).toBeNull();
    expect(normalisePath("/account/sign-in")).toBeNull();
    expect(normalisePath("not-a-path")).toBeNull();
    expect(normalisePath("/x".repeat(100))).toBeNull();
    expect(normalisePath("/plans/<script>")).toBeNull();
  });

  it("keeps only the referrer's host and ignores our own site", () => {
    expect(referrerHost("https://www.google.com/search?q=netflix+plans", "bettertier.com")).toBe("google.com");
    expect(referrerHost("https://bettertier.com/plans", "bettertier.com")).toBeNull();
    expect(referrerHost("https://www.bettertier.com/", "bettertier.com")).toBeNull();
    expect(referrerHost("garbage", "bettertier.com")).toBeNull();
    expect(referrerHost(null, "bettertier.com")).toBeNull();
  });

  it("classifies devices and bots", () => {
    expect(deviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Mobile Safari")).toBe("phone");
    expect(deviceType("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
    expect(deviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128")).toBe("desktop");
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("UptimeRobot/2.0")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot("Mozilla/5.0 (Windows NT 10.0) Chrome/128")).toBe(false);
  });

  it("produces a short hash that is stable within a day and different across days", () => {
    const a = visitorHash("203.0.113.5", "Chrome", "2026-09-22");
    const b = visitorHash("203.0.113.5", "Chrome", "2026-09-22");
    const c = visitorHash("203.0.113.5", "Chrome", "2026-09-23");
    const d = visitorHash("203.0.113.6", "Chrome", "2026-09-22");
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a).not.toContain("203.0.113.5");
  });
});
