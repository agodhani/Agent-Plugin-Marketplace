import { test, expect } from "@playwright/test";

/** UI regression: catch pages rendering unstyled (CSS missing/broken). */
test.describe("ui / styling", () => {
  test("stylesheet loads and computed styles are applied", async ({ page }) => {
    await page.goto("/");

    // every linked stylesheet serves 200
    const hrefs = await page.locator('link[rel="stylesheet"]').evaluateAll((ls) =>
      ls.map((l) => (l as HTMLLinkElement).href)
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const resp = await page.request.get(href);
      expect(resp.status()).toBe(200);
    }

    // computed styles prove Tailwind actually rendered
    const body = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { font: s.fontFamily, radius: s.borderRadius };
    });
    expect(body.font.toLowerCase()).not.toContain("times");

    // a catalog card has real styling (border-radius + padding applied)
    const card = page.locator('a[href^="/plugins/"]').first();
    const style = await card.evaluate((el) => {
      const s = getComputedStyle(el);
      return { radius: parseFloat(s.borderTopLeftRadius), pad: parseFloat(s.paddingTop), bg: s.backgroundColor };
    });
    expect(style.radius).toBeGreaterThan(4);
    expect(style.pad).toBeGreaterThan(0);

    // hero renders its gradient
    const hero = page.locator("h1", { hasText: "Agent Plugin Marketplace" }).locator("..");
    const bg = await hero.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain("gradient");
  });
});
