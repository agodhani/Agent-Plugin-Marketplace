import { test, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const stamp = Date.now();
const DB = path.join(process.cwd(), ".test-data", "marketplace.db");
const db = () => { const d = new DatabaseSync(DB); d.exec("PRAGMA busy_timeout = 5000"); return d; };
let bobId = 0;

test.describe.serial("pagination", () => {
  test.beforeAll(() => {
    const d = db();
    bobId = (d.prepare(`SELECT id FROM users WHERE email='bob@acme.dev'`).get() as { id: number }).id;
    const ins = d.prepare(`INSERT INTO plugins (slug, name, type, summary, about, readme, faq, permissions, risk_level, risk_score, status, author_id, current_version, install_command, downloads, created_at, updated_at) VALUES (?, ?, 'skill', ?, '', '', '[]', '[]', 'low', 0, 'approved', ?, '1.0.0', 'agenthub install x', ?, datetime('now'), datetime('now'))`);
    const insTag = d.prepare(`INSERT INTO plugin_tags (plugin_id, tag) VALUES (?, ?)`);
    for (let i = 1; i <= 30; i++) {
      const slug = `pg-${stamp}-${i}`;
      const r = ins.run(slug, `Paged ${stamp} ${i}`, `Paged plugin ${i}`, bobId, 100 + i);
      insTag.run(Number(r.lastInsertRowid), `pg-${stamp}`);
    }
    d.close();
  });
  test.afterAll(() => {
    const d = db();
    d.exec(`DELETE FROM plugin_tags WHERE plugin_id IN (SELECT id FROM plugins WHERE slug LIKE 'pg-${stamp}-%')`);
    d.exec(`DELETE FROM plugins WHERE slug LIKE 'pg-${stamp}-%'`);
    d.close();
  });

  test("grid paginates at 24", async ({ page }) => {
    await page.goto(`/?q=pg-${stamp}`);
    await expect(page.getByRole("article")).toHaveCount(24);
    await expect(page.getByText(`Showing 1–24 of 30`)).toBeVisible();
    await page.getByRole("link", { name: /Next/ }).click();
    await page.waitForURL(/page=2/);
    await expect(page.getByRole("article")).toHaveCount(6);
    await expect(page.getByText(`Showing 25–30 of 30`)).toBeVisible();
    await page.getByRole("link", { name: /Previous/ }).click();
    await expect(page.getByRole("article")).toHaveCount(24);
    await page.goto(`/?q=pg-${stamp}&page=99`);
    await expect(page.getByText(`Showing 25–30 of 30`)).toBeVisible();
    await page.goto(`/?q=pg-${stamp}&page=2`);
    await page.getByRole("button", { name: "Skills" }).click();
    await page.waitForURL((u) => !u.searchParams.has("page"));
  });

  test("publisher page paginates; stats cover all plugins", async ({ page }) => {
    await page.goto(`/publishers/${bobId}`);
    const arts = page.getByRole("article");
    await expect(arts.first()).toBeVisible();
    expect(await arts.count()).toBe(24);
    await expect(page.getByRole("link", { name: /Next/ })).toBeVisible();
    const d = new DatabaseSync(DB, { readOnly: true });
    const sum = (d.prepare(`SELECT COALESCE(SUM(downloads),0) s FROM plugins WHERE author_id=? AND status='approved'`).get(bobId) as { s: number }).s;
    const cnt = (d.prepare(`SELECT COUNT(*) c FROM plugins WHERE author_id=? AND status='approved'`).get(bobId) as { c: number }).c;
    d.close();
    await expect(page.getByText(String(cnt)).first()).toBeVisible();
    await expect(page.getByText(sum.toLocaleString())).toBeVisible();
  });
});
