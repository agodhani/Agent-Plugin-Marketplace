import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { login } from "./helpers";

const CLI = path.join(process.cwd(), "public", "agenthub.mjs");
const URL_ = "http://localhost:3100";

function run(args: string[], env: Record<string, string> = {}, { fail = false } = {}) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], {
      env: { ...process.env, AGENTHUB_URL: URL_, ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e: any) {
    if (fail) return { code: e.status ?? 1, out: String(e.stdout ?? "") + String(e.stderr ?? "") };
    throw e;
  }
}

async function makeToken(page: import("@playwright/test").Page, email: string, pass: string, name: string) {
  await login(page, email, pass);
  await page.goto("/profile");
  await page.locator("#tokens input").fill(name);
  await page.getByRole("button", { name: "Create token" }).click();
  const box = page.getByTestId("new-token");
  await expect(box).toBeVisible();
  const token = (await box.locator("code").textContent())!.trim();
  expect(token).toMatch(/^ahp_/);
  return token;
}

test.describe.serial("agenthub cli + tokens", () => {
  let aliceToken: string;
  let bobToken: string;
  const dirs: string[] = [];
  const tmp = () => { const d = mkdtempSync(path.join(os.tmpdir(), "ah-")); dirs.push(d); return d; };
  test.afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

  test("token creation shows the value once", async ({ page }) => {
    aliceToken = await makeToken(page, "alice@acme.dev", "password123", `e2e-cli ${Date.now()}`);
    await expect(page.locator("#tokens")).toContainText("e2e-cli");
    await expect(page.locator("#tokens")).toContainText(aliceToken.slice(0, 12));
    await page.reload();
    await expect(page.getByTestId("new-token")).toHaveCount(0);
  });

  test("api auth: /api/v1/me and download accept the token", async ({ page }) => {
    const me = await page.request.get(`${URL_}/api/v1/me`, { headers: { Authorization: `Bearer ${aliceToken}` } });
    expect(me.status()).toBe(200);
    expect((await me.json()).email).toBe("alice@acme.dev");
    const noAuth = await page.request.get(`${URL_}/api/v1/me`);
    expect(noAuth.status()).toBe(401);
    const d = new DatabaseSync(path.join(process.cwd(), ".test-data", "marketplace.db"), { readOnly: true });
    const id = (d.prepare(`SELECT id FROM plugins WHERE slug='github-mcp'`).get() as { id: number }).id;
    d.close();
    const zip = await page.request.get(`${URL_}/api/plugins/${id}/download`, { headers: { Authorization: `Bearer ${aliceToken}` } });
    expect(zip.status()).toBe(200);
    expect(zip.headers()["content-type"]).toContain("zip");
    const noZip = await page.request.get(`${URL_}/api/plugins/${id}/download`);
    expect(noZip.status()).toBe(401);
  });

  test("install into a temp dir writes files, merges mcp.json, records installs", async () => {
    const root = tmp();
    writeFileSync(path.join(root, ".mcp.json"), JSON.stringify({ mcpServers: { mine: { command: "x" } }, other: 1 }));
    const env = { AGENTHUB_TOKEN: aliceToken };

    const r1 = run(["install", "github-mcp", "--agent", "claude", "--dir", root], env);
    expect(r1.out).toContain("github-mcp");
    expect(existsSync(path.join(root, ".agenthub", "github-mcp", "mcp.json"))).toBe(true);
    const mcp = JSON.parse(readFileSync(path.join(root, ".mcp.json"), "utf8"));
    expect(mcp.mcpServers.mine).toEqual({ command: "x" });
    expect(mcp.other).toBe(1);
    const gh = mcp.mcpServers["github-mcp"];
    expect(gh.command).toBe("node");
    expect(gh.args[0]).toBe(path.join(root, ".agenthub", "github-mcp", "src", "index.ts"));
    expect(gh.env.GITHUB_TOKEN).toBe("${GITHUB_TOKEN}");

    const r2 = run(["install", "code-review-assistant", "--agent", "cursor", "--dir", root], env);
    expect(r2.code).toBe(0);
    expect(existsSync(path.join(root, ".cursor", "skills", "code-review-assistant", "SKILL.md"))).toBe(true);

    const r3 = run(["playbook", "install", "frontend-agent-kit", "--agent", "claude", "--dir", root], env);
    expect(r3.code).toBe(0);
    expect(existsSync(path.join(root, ".claude", "skills", "code-review-assistant"))).toBe(true);
    expect(existsSync(path.join(root, ".claude", "skills", "pr-summarizer"))).toBe(true);
    expect(existsSync(path.join(root, ".agenthub", "github-mcp"))).toBe(true);
    const rec = JSON.parse(readFileSync(path.join(root, ".agenthub", "installed.json"), "utf8"));
    expect(rec.map((x: { slug: string }) => x.slug)).toEqual(expect.arrayContaining(["github-mcp", "code-review-assistant", "pr-summarizer"]));
  });

  test("unmarked existing dir fails without --force; login writes 0600 config", async () => {
    const root = tmp();
    const cfg = path.join(tmp(), "config.json");
    const env = { AGENTHUB_TOKEN: aliceToken, AGENTHUB_CONFIG: cfg };
    const pre = path.join(root, ".claude", "skills", "pr-summarizer");
    mkdirSync(pre, { recursive: true });
    writeFileSync(path.join(pre, "keep.txt"), "x");
    const r = run(["install", "pr-summarizer", "--agent", "claude", "--dir", root], env, { fail: true });
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/force/i);
    const r2 = run(["install", "pr-summarizer", "--agent", "claude", "--dir", root, "--force"], env);
    expect(r2.code).toBe(0);

    const loginOut = run(["login", "--url", URL_, "--token", aliceToken], { AGENTHUB_CONFIG: cfg, AGENTHUB_TOKEN: "", AGENTHUB_URL: "" });
    expect(loginOut.out).toContain("Alice");
    expect(statSync(cfg).mode & 0o777).toBe(0o600);
    const who = run(["whoami"], { AGENTHUB_CONFIG: cfg, AGENTHUB_TOKEN: "", AGENTHUB_URL: "" });
    expect(who.out).toContain("Alice");
  });

  test("invalid slug is rejected before any filesystem use", async () => {
    const root = tmp();
    const parent = path.dirname(root);
    const r = run(["install", "../escape", "--dir", root], { AGENTHUB_TOKEN: aliceToken }, { fail: true });
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/invalid slug/);
    expect(existsSync(path.join(parent, "escape"))).toBe(false);
    expect(existsSync(path.join(root, "escape"))).toBe(false);
  });

  test("bob's token can't read a pending plugin's files", async ({ page }) => {
    bobToken = await makeToken(page, "bob@acme.dev", "password123", `e2e-bob ${Date.now()}`);
    const res = await page.request.get(`${URL_}/api/v1/plugins/awesome-utility-pack/files`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    expect(res.status()).toBe(404);
  });

  test("revoking the token kills API and CLI auth", async ({ page }) => {
    await login(page, "alice@acme.dev", "password123");
    await page.goto("/profile");
    const row = page.locator("#tokens li").filter({ hasText: "e2e-cli" }).first();
    await row.getByRole("button", { name: "Revoke" }).click();
    await expect(page.locator("#tokens li").filter({ hasText: "e2e-cli" })).toHaveCount(0);
    const me = await page.request.get(`${URL_}/api/v1/me`, { headers: { Authorization: `Bearer ${aliceToken}` } });
    expect(me.status()).toBe(401);
    const who = run(["whoami"], { AGENTHUB_TOKEN: aliceToken }, { fail: true });
    expect(who.code).not.toBe(0);
    expect(who.out).toMatch(/401|unauthor/i);
  });

  test("cli page + script are served", async ({ page }) => {
    const res = await page.request.get(`${URL_}/agenthub.mjs`);
    expect(res.status()).toBe(200);
    expect((await res.text()).startsWith("#!/usr/bin/env node")).toBe(true);
    await page.goto("/cli");
    for (const t of ["1 · Create a token", "2 · Install the CLI", "3 · Log in", "4 · Install"]) {
      await expect(page.getByText(t)).toBeVisible();
    }
  });
});
