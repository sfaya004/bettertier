import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = ["/", "/check", "/check/netflix", "/plans", "/plans/netflix", "/plans/netflix/standard-vs-premium", "/help", "/support", "/my-subscriptions", "/account/sign-in"];

for (const path of pages) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
  });
}

test("axe: result page", async ({ page }) => {
  await page.goto("/check/netflix");
  await page.getByRole("button", { name: /^Premium/ }).click();
  await page.getByRole("button", { name: /Yes, that/ }).click();
  for (let i = 0; i < 6; i++) {
    if (!(await page.getByText(/Question \d/).isVisible().catch(() => false))) break;
    await page.getByRole("button", { name: "I'm not sure" }).click();
  }
  await expect(page.getByRole("heading", { level: 1 })).not.toContainText("Question");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test("touch targets are at least 44px on the question screen", async ({ page }) => {
  await page.goto("/check/netflix");
  const boxes = await page.getByRole("button").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(Math.min(...boxes)).toBeGreaterThanOrEqual(44);
});

test("text zoom to 200% keeps the page usable", async ({ page, isMobile }) => {
  test.skip(isMobile);
  await page.goto("/check/netflix");
  await page.addStyleTag({ content: "html{font-size:38px !important}" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /^Premium/ })).toBeVisible();
});
