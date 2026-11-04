import { test, expect, request as pwRequest } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { login } from "./helpers";

const db = () => new DatabaseSync(path.join(process.cwd(), ".test-data", "marketplace.db"), { readOnly: true });
const verifiedAt = (slug: string) => {
  const d = db();
  const r = d.prepare(`SELECT verified_at FROM plugins WHERE slug = ?`).get(slug) as { verified_at: string | null } | undefined;
  d.close();
  return r?.verified_at;
};
const auditCount = (slug: string) => {
  const d = db();
  const n = d
    .prepare(`SELECT COUNT(*) c FROM audit_log a JOIN plugins p ON p.id = a.entity_id WHERE a.action = 'plugin_verified' AND a.entity_type = 'plugin' AND p.slug = ?`)
    .get(slug) as { c: number };
  d.close();
  return n.c;
};

test("logged out: mark on verified card only, inside its box; detail shows badge + row, no heading", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("article", { name: "Secret Linter", exact: true }).first();
  const mark = card.getByRole("img", { name: "Verified" }).first();
  await expect(mark).toBeVisible();
  await expect(page.getByRole("article", { name: "GitHub MCP Server", exact: true }).getByRole("img", { name: "Verified" })).toHaveCount(0);
  const cb = await card.boundingBox(), mb = await mark.boundingBox();
  expect(mb!.x).toBeGreaterThanOrEqual(cb!.x - 1);
  expect(mb!.y).toBeGreaterThanOrEqual(cb!.y - 1);
  expect(mb!.x + mb!.width).toBeLessThanOrEqual(cb!.x + cb!.width + 1);
  expect(mb!.y + mb!.height).toBeLessThanOrEqual(cb!.y + cb!.height + 1);

  await page.goto("/plugins/secret-linter");
  await expect(page.getByTestId("verified-badge")).toBeVisible();
  const vrow = page.locator("dl > div").filter({ has: page.locator("dt", { hasText: /^Verified$/ }) });
  await expect(vrow).toContainText("Admin User");
  await expect(page.getByRole("heading", { name: "Verification" })).toHaveCount(0);
});

test("favorites grid shows the mark on the verified favorite only", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add Secret Linter to favorites" }).first().click();
  await page.getByRole("button", { name: "Add GitHub MCP Server to favorites" }).first().click();
  await page.goto("/favorites");
  const sl = page.getByRole("link", { name: /Secret Linter/ }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await expect(sl.getByRole("img", { name: "Verified" })).toBeVisible();
  const gm = page.getByRole("link", { name: /GitHub MCP Server/ }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await expect(gm.getByRole("img", { name: "Verified" })).toHaveCount(0);
});

test("filter chip toggles verified=1 and narrows catalog to verified cards", async ({ page }) => {
  await page.goto("/");
  const chip = page.getByRole("button", { name: "Verified" }).filter({ has: page.locator("svg") });
  await chip.click();
  await page.waitForURL(/verified=1/);
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  const results = page.locator("[data-testid=catalog-results]");
  await expect(results).toBeVisible();
  const cards = results.getByRole("article");
  await expect(cards.first()).toBeVisible();
  for (const c of await cards.all()) {
    await expect(c.getByRole("img", { name: "Verified" })).toHaveCount(1);
  }
  await expect(results.getByText("GitHub MCP Server")).toHaveCount(0);
  await chip.click();
  await page.waitForURL((u) => !u.searchParams.has("verified"));
  await expect(chip).toHaveAttribute("aria-pressed", "false");
});

test("alice sees no verification control", async ({ page }) => {
  await login(page, "alice@acme.dev", "password123");
  await page.goto("/plugins/pr-summarizer");
  await expect(page.getByRole("heading", { name: "Verification" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Verify|Remove verification/ })).toHaveCount(0);
});

test.describe.serial("admin verify/remove + replay enforcement", () => {
  let captured: { headers: Record<string, string>; body: string | null };

  test("admin verifies then removes through the UI", async ({ page, browser }) => {
    await login(page);
    await page.goto("/plugins/pr-summarizer");
    const reqPromise = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
    await page.getByRole("button", { name: "Verify plugin" }).click();
    const req = await reqPromise;
    captured = { headers: { "next-action": req.headers()["next-action"] }, body: req.postData() };

    await expect(page.getByTestId("verified-badge")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Plugin verified").first()).toBeVisible();
    await expect(page.getByText(/Verified by Admin User/).first()).toBeVisible();

    await page.getByRole("tab", { name: /Activity/ }).click();
    await expect(page.getByText("verified the plugin").first()).toBeVisible();

    const anon = await browser.newPage();
    await anon.goto("/");
    await expect(anon.getByRole("article", { name: "PR Summarizer", exact: true }).first().getByRole("img", { name: "Verified" })).toBeVisible();
    await anon.close();

    await page.getByRole("button", { name: "Remove verification" }).click();
    await expect(page.getByTestId("verified-badge")).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText("removed the plugin's verification").first()).toBeVisible();
    expect(verifiedAt("pr-summarizer")).toBeNull();
  });

  test("server-side enforcement: replayed action rejected for non-admin", async ({ page, request }) => {
    const before = auditCount("pr-summarizer");
    const headers = {
      "Next-Action": captured.headers["next-action"],
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
      Origin: "http://localhost:3100",
    };
    // anonymous
    const anon = await pwRequest.newContext();
    await anon.post("http://localhost:3100/plugins/pr-summarizer", { headers, data: captured.body });
    expect(verifiedAt("pr-summarizer")).toBeNull();
    expect(auditCount("pr-summarizer")).toBe(before);
    await anon.dispose();
    // alice (logged in)
    await login(page, "alice@acme.dev", "password123");
    await page.request.post("http://localhost:3100/plugins/pr-summarizer", { headers, data: captured.body });
    expect(verifiedAt("pr-summarizer")).toBeNull();
    expect(auditCount("pr-summarizer")).toBe(before);
    // positive control: admin replay works
    const adminPage = await page.context().newPage();
    await login(adminPage);
    await adminPage.request.post("http://localhost:3100/plugins/pr-summarizer", { headers, data: captured.body });
    await expect.poll(() => verifiedAt("pr-summarizer")).not.toBeNull();
    await expect.poll(() => auditCount("pr-summarizer")).toBe(before + 1);
    await adminPage.goto("/plugins/pr-summarizer");
    await adminPage.getByRole("button", { name: "Remove verification" }).click();
    await expect(adminPage.getByTestId("verified-badge")).toHaveCount(0, { timeout: 10000 });
    await adminPage.close();
  });
});

test("admin on own plugin sees the blocked message and no button", async ({ page }) => {
  await login(page);
  await page.goto("/plugins/github-mcp");
  await expect(page.getByText("can't change verification on your own plugin")).toBeVisible();
  await expect(page.getByRole("button", { name: /Verify|Remove verification/ })).toHaveCount(0);
});

test("admin on non-approved plugin sees published-only message", async ({ page }) => {
  await login(page);
  await page.goto("/plugins/awesome-utility-pack");
  await expect(page.getByText("Only published plugins can be verified.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Verify|Remove verification/ })).toHaveCount(0);
});

test("compare shows Verified row with badge for verified plugin only", async ({ page }) => {
  const d = db();
  const sl = d.prepare(`SELECT id FROM plugins WHERE slug='secret-linter'`).get() as { id: number };
  const gm = d.prepare(`SELECT id FROM plugins WHERE slug='github-mcp'`).get() as { id: number };
  d.close();
  await page.goto(`/compare?ids=${sl.id},${gm.id}`);
  const row = page.locator("tbody tr").filter({ has: page.locator("th", { hasText: /^Verified$/ }) });
  await expect(row.getByTestId("verified-badge")).toHaveCount(1);
  await expect(row.locator("td").nth(1)).toHaveText("—");
});

test("search-index flags verified; palette shows the mark", async ({ page }) => {
  const idx = await (await page.request.get("/api/search-index")).json();
  const sl = idx.plugins.find((x: { slug: string }) => x.slug === "secret-linter");
  const gm = idx.plugins.find((x: { slug: string }) => x.slug === "github-mcp");
  expect(sl.verified).toBe(true);
  expect(gm.verified).toBe(false);
  await page.goto("/");
  await page.getByRole("button", { name: "Search the catalog" }).first().click();
  await page.keyboard.type("Secret Linter");
  const opt = page.getByRole("option", { name: /Secret Linter/ });
  await expect(opt).toBeVisible();
  await expect(opt.getByRole("img", { name: "Verified" })).toBeVisible();
});
