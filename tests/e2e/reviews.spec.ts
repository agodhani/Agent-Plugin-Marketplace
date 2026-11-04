import { test, expect } from "@playwright/test";
import { ALICE, login } from "./helpers";

test.describe("reviews", () => {
  test("seeded ratings show on cards and detail; posting a review works", async ({ page }) => {
    await page.goto("/");
    // github-mcp card shows its seeded rating
    const card = page.getByRole("article", { name: "GitHub MCP Server", exact: true }).first();
    await expect(card.getByText("(3)")).toBeVisible();

    await login(page, ALICE.email, ALICE.password);
    await page.goto("/plugins/postgres-mcp");
    await page.getByRole("tab", { name: /Reviews/ }).click();
    // alice already has a seeded review -> form prefilled with update CTA
    await expect(page.getByRole("button", { name: "Update review" })).toBeVisible();

    // post a fresh review on a plugin alice hasn't reviewed
    await page.goto("/plugins/onboarding-guide");
    await page.getByRole("tab", { name: /Reviews/ }).click();
    await page.getByRole("button", { name: "Rate 4 stars" }).click();
    await page.fill('textarea[placeholder*="What worked"]', "Clear and useful — E2E");
    await page.getByRole("button", { name: "Post review" }).click();
    await expect(page.getByText("Review saved.")).toBeVisible();
    await expect(page.getByRole("listitem").getByText("Clear and useful — E2E")).toBeVisible();
    await expect(page.getByText("Alice Chen").first()).toBeVisible();
  });
});
