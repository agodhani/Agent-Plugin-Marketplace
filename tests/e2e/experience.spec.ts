import { test, expect } from "@playwright/test";
import { ADMIN, ALICE, login } from "./helpers";

test.describe("premium experience", () => {
  test("⌘K palette opens via keyboard, searches, and Enter navigates", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+KeyK");
    const dialog = page.getByRole("dialog", { name: "Search AgentHub" });
    await expect(dialog).toBeVisible();
    await page.keyboard.type("github");
    await expect(dialog.getByRole("option", { name: /GitHub MCP Server/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/plugins\/github-mcp/);
  });

  test("palette opens via navbar trigger; Escape closes", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search the catalog", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Search AgentHub" });
    await expect(dialog).toBeVisible();
    await page.keyboard.type("playbooks");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/playbooks$/);

    await page.keyboard.press("ControlOrMeta+KeyK");
    await expect(page.getByRole("dialog", { name: "Search AgentHub" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Search AgentHub" })).toHaveCount(0);
  });

  test("add-to-tray toast offers an action that opens the drawer", async ({ page }) => {
    await login(page, ALICE.email, ALICE.password);
    await page.goto("/plugins/github-mcp");
    await page.getByRole("button", { name: "Add GitHub MCP Server to tray" }).click();
    await expect(page.getByText("Added GitHub MCP Server to install tray")).toBeVisible();
    await page.getByRole("button", { name: "Open tray" }).click();
    await expect(page.getByRole("heading", { name: "Install tray" })).toBeVisible();
  });

  test("copying the install command toasts and writes the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/plugins/github-mcp");
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByText("Copied to clipboard")).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("amp install github-mcp");
  });

  test("activity marquee animates and stops under reduced motion", async ({ page }) => {
    await page.goto("/");
    const region = page.getByRole("region", { name: "Live marketplace activity" });
    await expect(region.locator('a[href^="/plugins/"]').first()).toBeVisible();
    const trackName = () => page.locator(".marquee-track").first().evaluate((el) => getComputedStyle(el).animationName);
    await expect.poll(trackName).not.toBe("none");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect.poll(() => page.locator(".marquee-track").first().evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await expect.poll(() => page.locator(".aurora").first().evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });

  test("agent chip stays on one line", async ({ page }) => {
    await page.goto("/");
    const chip = page.getByTestId("agent-chip");
    await expect(chip).toBeVisible();
    const m = await chip.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(el).lineHeight) || r.height;
      return { h: r.height, lh, scrollW: el.scrollWidth, clientW: el.clientWidth };
    });
    expect(m.h).toBeLessThan(m.lh * 2);
    expect(m.scrollW).toBeLessThanOrEqual(m.clientW);
  });

  test("reveal shelves reach full opacity and are disabled in print", async ({ page }) => {
    await page.goto("/");
    const shelf = page.getByText("Top rated", { exact: true }).locator("xpath=ancestor::section[1]");
    await shelf.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => shelf.evaluate((el) => getComputedStyle(el).opacity), { timeout: 10_000 })
      .toBe("1");
    await page.emulateMedia({ media: "print" });
    await expect
      .poll(async () => page.locator(".reveal").first().evaluate((el) => getComputedStyle(el).animationName))
      .toBe("none");
  });

  test("palette options are not uppercased", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+KeyK");
    const dialog = page.getByRole("dialog", { name: "Search AgentHub" });
    await expect(dialog).toBeVisible();
    await page.keyboard.type("github");
    const opt = dialog.getByRole("option", { name: /GitHub MCP Server/ });
    await expect(opt).toBeVisible();
    const tt = await opt.evaluate((el) => getComputedStyle(el).textTransform);
    expect(tt).toBe("none");
  });

  test("activity marquee only shows governed items", async ({ page }) => {
    await page.goto("/");
    const region = page.getByRole("region", { name: "Live marketplace activity" });
    await expect(region).toBeVisible();
    const text = (await region.textContent()) ?? "";
    expect(text).not.toContain("submitted");
    expect(text).not.toContain("Awesome Utility Pack");
  });

  test("hovering a card reveals its action toolbar", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("article", { name: "GitHub MCP Server", exact: true }).first();
    const toolbar = card.locator(".card-actions");
    await expect.poll(async () => toolbar.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
    await card.hover();
    await expect.poll(async () => toolbar.evaluate((el) => getComputedStyle(el).opacity), { timeout: 5_000 }).toBe("1");
    // and the Add button inside it is still clickable
    await toolbar.getByRole("button", { name: /Add .* to tray/ }).click();
    await expect(page.getByText(/Added .* to install tray/)).toBeVisible();
  });

  test("hero terminal types, resolves and shows installed line", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const term = page.getByTestId("hero-terminal");
    await expect(term).toBeVisible();
    await expect(term.getByText(/items installed in 2\.1s/)).toBeVisible({ timeout: 15_000 });
  });

  test("hero terminal is static under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const term = page.getByTestId("hero-terminal");
    await expect(term.getByText(/items installed in 2\.1s/)).toBeVisible();
  });

  test("sort select changes the catalog order", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Sort catalog" }).click();
    await page.getByRole("option", { name: "Most downloaded" }).click();
    await expect(page).toHaveURL(/sort=downloads/);
    // sort applies inside a filtered view — filter to plugins and check the first card
    await page.getByRole("button", { name: "Plugins", exact: true }).click();
    await expect(page).toHaveURL(/type=plugin/);
    const results = page.getByTestId("catalog-results");
    await expect(results.locator('a[href^="/plugins/"]').first()).toHaveAttribute("href", "/plugins/secret-linter");
  });

  test("custom 404 for unknown plugin slugs", async ({ page }) => {
    const resp = await page.goto("/plugins/does-not-exist");
    expect(resp?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page wandered off" })).toBeVisible();
  });

  test("install-for segments produce per-agent snippets", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/plugins/github-mcp");
    const install = page.locator("aside").first();
    await expect(install.getByText("amp install github-mcp")).toBeVisible();
    await install.getByRole("button", { name: "Claude Code" }).click();
    await expect(install.getByText('"mcpServers"')).toBeVisible();
    await expect(install.getByText('"github-mcp"')).toBeVisible();
    await install.getByRole("button", { name: "Copy" }).click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('"mcpServers"');
    expect(clip).toContain('"github-mcp"');
  });

  test("hero catalog-items stat matches the filters total", async ({ page }) => {
    await page.goto("/");
    const filterText = await page.getByText(/^\d+ of \d+ items?$/).textContent();
    const total = Number(filterText?.match(/of (\d+)/)?.[1]);
    expect(total).toBeGreaterThan(0);
    const dd = page.locator('section[aria-labelledby="hero-title"]').locator("dd", { hasText: "catalog items" });
    // waits for the count-up to reach the true total
    await expect
      .poll(async () => Number(((await dd.textContent()) ?? "").replace(/[^0-9].*$/s, "").replace(/,/g, "")), {
        timeout: 10_000,
      })
      .toBe(total);
  });

  test("mobile nav sheet opens and navigates", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const sheet = page.getByRole("dialog", { name: "Menu" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: "Playbooks" }).click();
    await expect(page).toHaveURL(/\/playbooks/);
    await expect(sheet).not.toBeVisible();
  });

  test("login shows the brand panel at desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await expect(page.getByText("Every agent.")).toBeVisible();
  });

  test("submit shows the governance pipeline steps", async ({ page }) => {
    await login(page, ALICE.email, ALICE.password);
    await page.goto("/submit");
    const steps = page.getByRole("list", { name: "Governance pipeline" }).or(page.locator('ol[aria-label="Governance pipeline"]'));
    for (const name of ["Upload", "Validation scan", "Security scan", "Risk score", "Admin review"]) {
      await expect(page.locator('ol[aria-label="Governance pipeline"]').getByText(name, { exact: true })).toBeVisible();
    }
  });

  test("pending submission marks Admin review as the current step", async ({ page }) => {
    await login(page);
    await page.goto("/admin");
    await page.locator("tr").filter({ hasText: "Awesome Utility Pack" }).getByRole("link").first().click();
    await expect(page).toHaveURL(/\/submissions\//);
    const current = page.locator('li[aria-current="step"]');
    await expect(current.getByText("Admin review")).toBeVisible();
  });

  test("playbook detail shows the terminal install block and copy toasts", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/playbooks/frontend-agent-kit");
    await expect(page.getByText("amp playbook install frontend-agent-kit")).toBeVisible();
    await page.getByRole("button", { name: "Copy command" }).click();
    await expect(page.getByText("Copied to clipboard")).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe("amp playbook install frontend-agent-kit");
  });
});
