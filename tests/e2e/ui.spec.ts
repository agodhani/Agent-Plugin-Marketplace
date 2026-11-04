import { test, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const dbRead = () => new DatabaseSync(path.join(process.cwd(), ".test-data", "marketplace.db"), { readOnly: true });
const nestedCount = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.querySelectorAll("a button, a a, a input, a select, a textarea, a [role=button]").length);

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
    const card = page.getByRole("article").first();
    const style = await card.evaluate((el) => {
      const s = getComputedStyle(el);
      return { radius: parseFloat(s.borderTopLeftRadius), pad: parseFloat(s.paddingTop), bg: s.backgroundColor };
    });
    expect(style.radius).toBeGreaterThan(4);
    expect(style.pad).toBeGreaterThan(0);

    // hero renders its gradient background
    const hero = page.locator('section[aria-labelledby="hero-title"]');
    const bg = await hero.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain("gradient");
  });
});

test("radix tabs switch content and FAQ accordion expands", async ({ page }) => {
  await page.goto("/plugins/github-mcp");
  // tabs (shadcn/radix) — switch to Versions and back
  await page.getByRole("tab", { name: /Versions/ }).click();
  await expect(page.getByText("v2.0.1").first()).toBeVisible();
  await page.getByRole("tab", { name: /FAQ/ }).click();
  const q = page.getByRole("button", { name: /GitHub Enterprise/i }).first();
  await expect(q).toBeVisible();
  if (await page.getByText("GITHUB_API_URL").isHidden()) await q.click();
  await expect(page.getByText("GITHUB_API_URL")).toBeVisible();
});

test("no interactive elements nested inside links", async ({ page }) => {
  const d = dbRead();
  const aliceId = (d.prepare(`SELECT id FROM users WHERE email = 'alice@acme.dev'`).get() as { id: number }).id;
  d.close();
  for (const url of ["/", "/?verified=1", "/playbooks/frontend-agent-kit", `/publishers/${aliceId}`, "/plugins/github-mcp"]) {
    await page.goto(url);
    await expect.poll(() => nestedCount(page), url).toBe(0);
  }
  // favorites: heart one card, then check /favorites
  await page.goto("/");
  await page.getByRole("button", { name: "Add Secret Linter to favorites" }).first().click();
  await page.goto("/favorites");
  await expect.poll(() => nestedCount(page), "/favorites").toBe(0);
});

test("card has one named link; footer click navigates; heart stays put", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("article", { name: "GitHub MCP Server", exact: true }).first();
  const links = card.getByRole("link");
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveAccessibleName("GitHub MCP Server");

  await card.click({ position: { x: 20, y: await card.evaluate((el) => el.clientHeight - 12) } });
  await expect(page).toHaveURL(/\/plugins\/github-mcp/);

  await page.goto("/");
  const card2 = page.getByRole("article", { name: "GitHub MCP Server", exact: true }).first();
  await card2.getByRole("button", { name: "Add GitHub MCP Server to favorites" }).click();
  await expect(page.getByText("Saved GitHub MCP Server to favorites").first()).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("touch: inline toolbar buttons still work over the stretched link", async ({ browser }) => {
  const ctx = await browser.newContext({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/");
  const card = page.getByRole("article", { name: "GitHub MCP Server", exact: true }).first();
  await card.getByRole("button", { name: /Add .* to tray/ }).tap();
  await expect(page.getByText("Added GitHub MCP Server to install tray").first()).toBeVisible();
  await expect(page).toHaveURL("/");
  await ctx.close();
});

test("star row uses CSS masks, no inline SVGs", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("article", { name: "GitHub MCP Server", exact: true }).first();
  const star = card.locator("[title*='review']").first();
  await expect(star).toBeVisible();
  expect(await star.locator("svg").count()).toBe(0);
  await expect(star).toContainText("(");
  // fill is a sibling, not nested inside the masked outline layer
  expect(await page.locator(".stars-outline .stars-filled").count()).toBe(0);
  const fillW = await card.locator(".stars-filled").first().evaluate((el) => getComputedStyle(el).width);
  expect(fillW).toBe("70px"); // avg 4.7 rounds to 5 filled stars
  // a no-reviews card still renders its label
  const d2 = dbRead();
  const noRev = (d2.prepare(`SELECT slug FROM plugins WHERE status='approved' AND id NOT IN (SELECT plugin_id FROM reviews) LIMIT 1`).get() as { slug: string } | undefined)?.slug;
  d2.close();
  if (noRev) {
    await page.goto(`/plugins/${noRev}`);
    await expect(page.getByText("No reviews").first()).toBeVisible();
  }
});

test("download Content-Length matches body size", async ({ page }) => {
  const d = dbRead();
  const id = (d.prepare(`SELECT id FROM plugins WHERE slug='github-mcp'`).get() as { id: number }).id;
  d.close();
  await page.goto("/login");
  await page.fill('input[name="email"]', "alice@acme.dev");
  await page.fill('input[name="password"]', "password123");
  await page.click('button:has-text("Sign in")');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  const res = await page.request.get(`/api/plugins/${id}/download`);
  expect(res.status()).toBe(200);
  const body = await res.body();
  expect(Number(res.headers()["content-length"])).toBe(body.length);
});
