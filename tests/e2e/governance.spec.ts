import { test, expect } from "@playwright/test";
import { ADMIN, ALICE, benignZip, login, reviewPlugin, sketchyZip, submitPlugin } from "./helpers";

test.describe.configure({ mode: "serial" });

const STAMP = Date.now();
const BENIGN_NAME = `E2E Benign ${STAMP}`;
const BENIGN_SLUG = `e2e-benign-${STAMP}`;
const SKETCHY_NAME = `E2E Sketchy ${STAMP}`;
const SKETCHY_SLUG = `e2e-sketchy-${STAMP}`;

test.describe("submission -> scan -> review pipeline", () => {
  test("seeded high-risk submission appears in the review queue with findings", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin");
    await expect(page.getByText("Awesome Utility Pack").first()).toBeVisible();
    // open its report
    await page.locator("tr").filter({ hasText: "Awesome Utility Pack" }).filter({ has: page.getByRole("link", { name: "Review" }) }).getByRole("link", { name: "Review" }).click();
    await expect(page).toHaveURL(/\/submissions\/\d+/);
    await expect(page.getByText("dangerous-exec")).toBeVisible();
    await expect(page.getByText("hardcoded-secret")).toBeVisible();
    await expect(page.getByText("high risk").first()).toBeVisible();
  });

  test("rejected submission updates statuses and is audit logged", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await reviewPlugin(page, "awesome-utility-pack", "Reject", "Fails security scan");
    // pending queue no longer contains it (it remains in decisions + audit log)
    const queue = page.locator("section").filter({ hasText: "Pending queue" });
    await expect(queue.locator("tr", { hasText: "Awesome Utility Pack" })).toHaveCount(0);
    // not visible on the public home page
    await page.goto("/?q=awesome");
    await expect(page.getByText("Nothing matches those filters")).toBeVisible();
    // audit log captured the decision
    await page.goto("/admin");
    await expect(page.getByText("rejected a submission").first()).toBeVisible();
  });

  test("clean submission is pending, then approves into the catalog", async ({ page }) => {
    await login(page, ALICE.email, ALICE.password);
    await submitPlugin(page, {
      name: BENIGN_NAME,
      type: "plugin",
      summary: "A clean plugin submitted by the E2E suite",
      tags: "e2e, testing",
      zip: await benignZip(BENIGN_NAME),
      permissions: ["read:files"],
    });
    // redirected to the pending plugin page
    await expect(page).toHaveURL(new RegExp(`/plugins/${BENIGN_SLUG}`));
    await expect(page.getByText("Pending review.")).toBeVisible();
    // not in public catalog yet
    await page.goto(`/?q=${encodeURIComponent(BENIGN_NAME)}`);
    await expect(page.getByText("Nothing matches those filters")).toBeVisible();
  });

  test("admin approves the clean submission; it becomes browsable", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await reviewPlugin(page, BENIGN_SLUG, "Approve", "Clean scan");
    await page.goto(`/?q=${encodeURIComponent(BENIGN_NAME)}`);
    await expect(page.getByText(BENIGN_NAME).first()).toBeVisible();
    // detail page is now public
    await page.goto(`/plugins/${BENIGN_SLUG}`);
    await expect(page.getByRole("heading", { name: BENIGN_NAME })).toBeVisible();
    await expect(page.getByText("Pending review.")).toHaveCount(0);
  });

  test("sketchy submission is flagged high-risk and can be rejected", async ({ page }) => {
    await login(page, ALICE.email, ALICE.password);
    await submitPlugin(page, {
      name: SKETCHY_NAME,
      type: "plugin",
      summary: "A suspicious plugin for the E2E suite",
      zip: await sketchyZip(SKETCHY_NAME),
      permissions: ["execute", "secrets"],
    });
    await expect(page).toHaveURL(new RegExp(`/plugins/${SKETCHY_SLUG}`));
    // view the scan report ourselves — should show findings
    await page.getByRole("link", { name: /scan report/i }).first().click();
    await expect(page.getByText("dangerous-exec")).toBeVisible();
    await expect(page.getByText("hardcoded-secret")).toBeVisible();

    await login(page, ADMIN.email, ADMIN.password);
    await reviewPlugin(page, SKETCHY_SLUG, "Reject", "Security findings");
    // author sees the rejected banner
    await login(page, ALICE.email, ALICE.password);
    await page.goto(`/plugins/${SKETCHY_SLUG}`);
    await expect(page.getByText(/Rejected/)).toBeVisible();
  });

  test("validation errors block submission before review", async ({ page }) => {
    await login(page, ALICE.email, ALICE.password);
    await page.goto("/submit");
    await page.fill('input[name="name"]', "ab");
    await page.fill('input[name="summary"]', "too short name test");
    await page.click('button:has-text("Submit for review")');
    await expect(page.getByText(/Validation failed: Name provided/)).toBeVisible();
    await expect(page).toHaveURL(/\/submit/);
  });
});

test.describe("versioning", () => {
  test("new version is gated by review then becomes current", async ({ page }) => {
    // BENIGN plugin is approved by now and owned by alice
    await login(page, ALICE.email, ALICE.password);
    await page.goto(`/plugins/${BENIGN_SLUG}/new-version`);
    await page.fill('input[name="version"]', "2.0.0");
    await page.fill('textarea[name="changelog"]', "Major update from E2E");
    await page.setInputFiles('input[name="file"]', {
      name: "v2.zip",
      mimeType: "application/zip",
      buffer: await benignZip(BENIGN_NAME),
    });
    await page.click('button:has-text("Submit version for review")');
    await expect(page).toHaveURL(new RegExp(`/plugins/${BENIGN_SLUG}`));
    // still shows old version as current
    await expect(page.getByText("v1.0.0").first()).toBeVisible();

    await login(page, ADMIN.email, ADMIN.password);
    await reviewPlugin(page, BENIGN_SLUG, "Approve", "v2 ok");
    await page.goto(`/plugins/${BENIGN_SLUG}`);
    await expect(page.getByText("v2.0.0").first()).toBeVisible();
    // activity tab records the version
    await page.getByRole("button", { name: /Activity/ }).click();
    await expect(page.getByText(/published a version/)).toBeVisible();
  });

  test("download endpoint serves a zip", async ({ page }) => {
    await login(page, ALICE.email, ALICE.password);
    const resp = await page.request.get("/api/plugins/2/download");
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toContain("application/zip");
    const body = await resp.body();
    expect(body.length).toBeGreaterThan(100);
    // zip magic bytes
    expect(body.subarray(0, 2).toString()).toBe("PK");
  });
});
