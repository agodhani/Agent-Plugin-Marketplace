import { test, expect } from "@playwright/test";
import { ADMIN, login, logout, register } from "./helpers";

test.describe("auth", () => {
  test("register creates account and signs in", async ({ page }) => {
    const email = `e2e-${Date.now()}@acme.dev`;
    await register(page, "E2E User", email);
    await expect(page.getByText("E2E")).toBeVisible();
    // lands logged in — profile shows email
    await page.goto("/profile");
    await expect(page.getByText(email)).toBeVisible();
  });

  test("admin login works and shows admin UI", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page.locator("header").getByText("ADMIN", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review", exact: true })).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Review console" })).toBeVisible();
  });

  test("member login works; admin area is protected", async ({ page }) => {
    await login(page, "alice@acme.dev", "password123");
    await expect(page.locator("header").getByText("ADMIN", { exact: true })).toHaveCount(0);
    await page.goto("/admin");
    // non-admin is redirected away from the review console
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', ADMIN.email);
    await page.fill('input[name="password"]', "wrong-password");
    await page.click('button:has-text("Sign in")');
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });

  test("logout returns to login page", async ({ page }) => {
    await login(page);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  });

  test("admin toggle on profile grants admin access", async ({ page }) => {
    await login(page, "bob@acme.dev", "password123");
    await page.goto("/profile");
    await page.getByRole("switch").click();
    await expect(page.locator("header").getByText("ADMIN", { exact: true })).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Review console" })).toBeVisible();
    // toggle back off to keep test DB tidy
    await page.goto("/profile");
    await page.getByRole("switch").click();
    await expect(page.locator("header").getByText("ADMIN", { exact: true })).toHaveCount(0);
  });
});
