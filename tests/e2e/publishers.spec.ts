import { test, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { login, logout, register, submitPlugin, reviewPlugin, benignZip } from "./helpers";

const stamp = Date.now();
const pluginName = `Twin Plugin ${stamp}`;
const pluginSlug = `twin-plugin-${stamp}`;

const userId = (email: string) => {
  const d = new DatabaseSync(path.join(process.cwd(), ".test-data", "marketplace.db"), { readOnly: true });
  const r = d.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as { id: number } | undefined;
  d.close();
  return r!.id;
};

test.describe.serial("publisher pages match plugins by author id, not name", () => {
  test("two authors with the same display name get separate publisher pages", async ({ page }) => {
    // register twin A and submit a benign plugin
    const emailA = `twin-a-${stamp}@acme.dev`;
    const emailB = `twin-b-${stamp}@acme.dev`;
    await register(page, "Name Twin", emailA);
    await submitPlugin(page, { name: pluginName, summary: "A benign twin plugin.", zip: await benignZip(pluginSlug) });

    // admin approves it
    await login(page);
    await reviewPlugin(page, pluginSlug, "Approve");

    // register twin B (same display name, different account)
    await logout(page);
    await register(page, "Name Twin", emailB);

    const idA = userId(emailA);
    const idB = userId(emailB);
    expect(idA).not.toBe(idB);

    await page.goto(`/publishers/${idA}`);
    await expect(page.getByRole("article", { name: pluginName, exact: true })).toHaveCount(1);

    await page.goto(`/publishers/${idB}`);
    await expect(page.getByText("Nothing published yet.")).toBeVisible();
    await expect(page.getByRole("article", { name: pluginName, exact: true })).toHaveCount(0);
  });
});
