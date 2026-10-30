import { test, expect } from "@playwright/test";

test.describe("browse & discovery", () => {
  test("home renders hero, catalog cards and filters", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Agent Plugin Marketplace" })).toBeVisible();
    await expect(page.getByText("GitHub MCP Server").first()).toBeVisible();
    await expect(page.getByText("Code Review Assistant").first()).toBeVisible();
    // filter chips present
    await expect(page.getByRole("button", { name: "MCP Servers" })).toBeVisible();
    await expect(page.getByRole("button", { name: "All tags" })).toBeVisible();
  });

  test("text search narrows results", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[placeholder*="Search"]', "github");
    await expect(page.getByText("GitHub MCP Server").first()).toBeVisible();
    await expect(page.getByText("Postgres Query Tool")).toHaveCount(0);
  });

  test("type chip filters to one type", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "MCP Servers" }).click();
    await expect(page).toHaveURL(/type=mcp/);
    await expect(page.getByText("GitHub MCP Server").first()).toBeVisible();
    await expect(page.getByText("GitHub MCP Server").first()).toBeVisible();
    // a skill should be filtered out
    await expect(page.getByText("Code Review Assistant")).toHaveCount(0);
  });

  test("tag param filters via URL", async ({ page }) => {
    await page.goto("/?tag=database");
    await expect(page.getByText("Postgres Query Tool").first()).toBeVisible();
    await expect(page.getByText("Code Review Assistant")).toHaveCount(0);
  });

  test("plugin detail page shows tabs, install command and versions", async ({ page }) => {
    await page.goto("/plugins/github-mcp");
    await expect(page.getByRole("heading", { name: "GitHub MCP Server" })).toBeVisible();
    await expect(page.getByText("amp install github-mcp").first()).toBeVisible();
    // tabs
    await page.getByRole("button", { name: "README" }).click();
    await expect(page.getByText(/GITHUB_API_URL|GITHUB_TOKEN/).first()).toBeVisible();
    await page.getByRole("button", { name: /Versions/ }).click();
    await expect(page.getByText("v2.0.1").first()).toBeVisible();
    await expect(page.getByText(/pagination bug/i)).toBeVisible();
    await page.getByRole("button", { name: /FAQ/ }).click();
    await expect(page.getByText(/GitHub Enterprise/)).toBeVisible();
  });

  test("empty search shows empty state", async ({ page }) => {
    await page.goto("/?q=zzz-no-match-zzz");
    await expect(page.getByText("Nothing matches those filters")).toBeVisible();
  });
});
