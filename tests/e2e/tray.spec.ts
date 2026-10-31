import { test, expect } from "@playwright/test";
import { ALICE, login } from "./helpers";

test.describe("install tray", () => {
  test("collect plugins, generate one install command, save as playbook", async ({ page }) => {
    await login(page, ALICE.email, ALICE.password);
    await page.goto("/");

    // add two plugins from their cards — adding shows a toast instead of opening the drawer
    await page.locator('a[href="/plugins/github-mcp"].card-accent').first().getByRole("button", { name: /Add .* to tray/ }).click();
    await expect(page.getByRole("button", { name: "Open tray" })).toBeVisible();
    await page.getByRole("button", { name: "Open tray" }).click();
    await expect(page.getByRole("heading", { name: "Install tray" })).toBeVisible();
    await page.getByRole("button", { name: "Close tray" }).click();
    await page.locator('a[href="/plugins/code-review-assistant"].card-accent').first().getByRole("button", { name: /Add .* to tray/ }).click();
    // open the drawer via the floating tray pill
    await page.getByRole("button", { name: /Install tray/ }).click();

    // tray shows both items
    await expect(page.getByRole("heading", { name: "Install tray" })).toBeVisible();
    await expect(page.getByText("github-mcp · mcp")).toBeVisible();
    await expect(page.getByText("code-review-assistant · skill")).toBeVisible();

    // default target: one amp command for the whole set
    await expect(page.locator("pre")).toContainText("amp install github-mcp code-review-assistant");

    // Claude Code target emits an mcp.json block + amp line for the skill
    await page.getByRole("button", { name: "Claude Code" }).click();
    await expect(page.locator("pre")).toContainText('"mcpServers"');
    await expect(page.locator("pre")).toContainText('"github-mcp"');
    await expect(page.locator("pre")).toContainText("amp install code-review-assistant");

    // save the tray as a playbook
    const name = `Tray Playbook ${Date.now()}`;
    await page.fill('input[placeholder="My agent toolkit"]', name);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForURL(/\/playbooks\//);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("GitHub MCP Server").first()).toBeVisible();
    await expect(page.getByText("Code Review Assistant").first()).toBeVisible();
  });
});
