import { test, expect } from "@playwright/test";
import { ALICE, login } from "./helpers";

test.describe("playbooks", () => {
  test("seeded playbooks are listed", async ({ page }) => {
    await page.goto("/playbooks");
    await expect(page.getByText("Frontend Agent Kit")).toBeVisible();
    await expect(page.getByText("Data Agent Stack")).toBeVisible();
  });

  test("create a playbook, install command, and add plugins from detail pages", async ({ page }) => {
    const name = `E2E Playbook ${Date.now()}`;
    await login(page, ALICE.email, ALICE.password);
    await page.goto("/playbooks/new");
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="description"]', "E2E bundle");
    // pick two plugins via search
    await page.fill('input[placeholder="Search the catalog…"]', "github");
    await page.getByText("GitHub MCP Server").click();
    await page.fill('input[placeholder="Search the catalog…"]', "review");
    await page.getByText("Code Review Assistant").click();
    await expect(page.getByText("2 selected")).toBeVisible();
    await page.click('button:has-text("Create playbook")');
    await page.waitForURL((u) => u.pathname.startsWith("/playbooks/") && u.pathname !== "/playbooks/new", { timeout: 20_000 });
    const slug = page.url().split("/playbooks/")[1];
    expect(slug).toContain("e2e-playbook");
    // reload once to dodge any RSC-vs-commit race, then check the items
    await page.reload();
    // detail page: one-command install + the two picked items
    await expect(page.getByText(`amp playbook install ${slug}`)).toBeVisible();
    await expect(page.getByText("GitHub MCP Server").first()).toBeVisible();
    await expect(page.getByText("Code Review Assistant").first()).toBeVisible();
    await expect(page.getByText(/\d+ items/).first()).toBeVisible();

    // add a third plugin from its detail page (aside playbook widget)
    await page.goto("/plugins/postgres-mcp");
    await page.locator("aside").getByRole("button", { name }).click();
    // playbook links back from the plugin page
    await expect(page.locator("aside").getByRole("link", { name })).toBeVisible();
    await page.goto(`/playbooks/${slug}`);
    await expect(page.getByText("Postgres Query Tool").first()).toBeVisible();
    await expect(page.getByText("3 items").first()).toBeVisible();
  });

  test("playbook requires at least one item", async ({ page }) => {
    await login(page, ALICE.email, ALICE.password);
    await page.goto("/playbooks/new");
    await page.fill('input[name="name"]', "Empty playbook");
    await page.click('button:has-text("Create playbook")');
    await expect(page.getByText(/Pick at least one plugin/)).toBeVisible();
    await expect(page).toHaveURL(/\/playbooks\/new/);
  });
});
