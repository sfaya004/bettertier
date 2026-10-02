import { test, expect } from "@playwright/test";

test.describe("consumer flow", () => {
  test("landing → search → plan → price → questions → result → dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("right subscription");
    await page.getByRole("link", { name: "Check my subscription" }).first().click();
    await expect(page).toHaveURL(/\/check$/);

    await page.getByLabel("Type the name of the subscription").fill("netfl");
    await page.getByRole("link", { name: /Netflix/ }).first().click();
    await expect(page).toHaveURL(/\/check\/netflix/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Which Netflix plan");

    await page.getByRole("button", { name: /^Premium/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Is this what you pay");
    await page.getByRole("button", { name: /Yes, that/ }).click();

    // Answer questions until the result appears (never more than 6).
    for (let i = 0; i < 6; i++) {
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toBeVisible();
      const text = (await h1.textContent()) ?? "";
      if (/paying for more|good fit|missing|closer look|couldn't verify|one plan/i.test(text)) break;
      await expect(page.getByText(/Question \d of \d/)).toBeVisible();
      // Always pick the first (smallest) real option.
      await page.getByRole("button", { name: /^(Just one|Full HD is fine|No, I don't need this|Nobody outside my home)/ }).first().click();
    }
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/paying for more than you need/i);
    await expect(page.getByText(/Estimated savings/)).toBeVisible();
    await expect(page.getByText(/a year/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Why?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /give up/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Change my plan on Netflix/ })).toHaveAttribute("rel", /noopener/);

    await page.getByRole("link", { name: "See all my subscriptions" }).click();
    await expect(page).toHaveURL(/my-subscriptions/);
    await expect(page.getByRole("rowheader", { name: /Netflix/ }).first()).toBeVisible();
    await expect(page.getByText(/You currently pay about/)).toBeVisible();
  });

  test("'I'm not sure' path never blocks the user", async ({ page }) => {
    await page.goto("/check/spotify");
    await page.getByRole("button", { name: /not sure which plan/ }).click();
    for (let i = 0; i < 6; i++) {
      const text = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
      if (!/Question|\?$/.test(text) || /looks like the right fit|more information/.test(text)) break;
      await page.getByRole("button", { name: "I'm not sure" }).click();
    }
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/right fit|more information|one plan/);
    await expect(page.getByText(/How to find your plan/)).toBeVisible();
  });

  test("back button removes the last answer and restores the question", async ({ page }) => {
    await page.goto("/check/netflix");
    await page.getByRole("button", { name: /^Standard with ads/ }).click();
    await page.getByRole("button", { name: /Yes, that/ }).click();
    const first = await page.getByRole("heading", { level: 1 }).textContent();
    await page.getByRole("button", { name: /^Just one/ }).click();
    await page.getByRole("button", { name: "← Back" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(first ?? "");
  });

  test("keyboard-only user can complete the plan step", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard test is desktop-only");
    await page.goto("/check/netflix");
    // Tab through the header until the first plan button is focused, then press Enter.
    const target = page.getByRole("button", { name: /^Standard with ads/ });
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      if (await target.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(target).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Is this what you pay");
    // Focus moved to the new heading, so screen readers announce it.
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  });

  test("no horizontal overflow on the result page", async ({ page }) => {
    await page.goto("/check/max");
    await page.getByRole("button", { name: /^Premium/ }).click();
    await page.getByRole("button", { name: /Yes, that/ }).click();
    for (let i = 0; i < 6; i++) {
      const text = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
      if (!(await page.getByText(/Question \d/).isVisible().catch(() => false)) && !/\?$/.test(text)) break;
      await page.getByRole("button", { name: "I'm not sure" }).click();
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });

  test("plan pages render with sources and canonical", async ({ page }) => {
    await page.goto("/plans/netflix");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Netflix plans compared");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/plans\/netflix$/);
    await expect(page.locator('script[type="application/ld+json"]').first()).toHaveCount(1);
    await expect(page.getByRole("heading", { name: /Where this information comes from/ })).toBeVisible();
    await page.getByRole("link", { name: /Standard with ads vs Standard/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("vs");
  });

  test("unknown subscription shows a friendly 404", async ({ page }) => {
    const res = await page.goto("/check/not-a-real-service");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("couldn't find that page");
  });
});
