import { test, expect } from "@playwright/test";
import { ALICE, login } from "./helpers";

test.describe("teams", () => {
  test("create team, mark plugin usage, filter by team", async ({ page }) => {
    const teamName = `E2E Team ${Date.now()}`;
    await login(page, ALICE.email, ALICE.password);

    // create the team
    await page.goto("/teams");
    await page.fill('input[name="name"]', teamName);
    await page.fill('input[name="description"]', "Created by E2E tests");
    await page.click('button:has-text("Create team")');
    await expect(page.getByRole("heading", { name: teamName })).toBeVisible();

    // mark a plugin as used by that team
    await page.goto("/plugins/postgres-mcp");
    await page.getByRole("button", { name: new RegExp(teamName) }).click();
    // the team chip now appears under "Teams using this"
    await expect(page.locator("span", { hasText: teamName }).first()).toBeVisible();

    // home page team filter shows the plugin
    await page.goto("/");
    await page.locator("select").first().selectOption({ label: `Used by ${teamName}` });
    await expect(page.getByText("Postgres Query Tool").first()).toBeVisible();
    await expect(page.getByText("Code Review Assistant")).toHaveCount(0);
  });

  test("join and leave a team", async ({ page }) => {
    await login(page, "bob@acme.dev", "password123");
    await page.goto("/teams");
    const card = page.locator("div.rounded-2xl", { hasText: "Data Science" }).first();
    await card.getByRole("button", { name: "Join" }).click();
    await expect(card.getByRole("button", { name: "Leave" })).toBeVisible();
    await card.getByRole("button", { name: "Leave" }).click();
    await expect(card.getByRole("button", { name: "Join" })).toBeVisible();
  });
});
