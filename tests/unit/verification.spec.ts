import { test, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { verificationBlockReason } from "../../lib/verification";
import { ensureSchema } from "../../lib/db";

const approved = { status: "approved", author_id: 2 };
const admin = { id: 1, is_admin: 1 };

test("rule: gate order", () => {
  expect(verificationBlockReason(approved, null, true)).toBe("Only admins can change verification.");
  expect(verificationBlockReason(approved, { id: 5, is_admin: 0 }, true)).toBe("Only admins can change verification.");
  expect(verificationBlockReason(approved, { id: 2, is_admin: 1 }, true)).toBe("You can't change verification on your own plugin — another admin must.");
  expect(verificationBlockReason(approved, { id: 2, is_admin: 1 }, false)).toBe("You can't change verification on your own plugin — another admin must.");
  expect(verificationBlockReason({ status: "pending", author_id: 2 }, admin, true)).toBe("Only published plugins can be verified.");
  expect(verificationBlockReason({ status: "pending", author_id: 2 }, admin, false)).toBeNull();
  expect(verificationBlockReason(approved, admin, true)).toBeNull();
});

test("ensureSchema: fresh DB gets both columns", () => {
  const db = new DatabaseSync(":memory:");
  ensureSchema(db);
  const cols = (db.prepare(`PRAGMA table_info(plugins)`).all() as { name: string }[]).map((c) => c.name);
  expect(cols).toContain("verified_at");
  expect(cols).toContain("verified_by");
});

test("ensureSchema: migrates an old DB, preserves rows", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE plugins (id INTEGER PRIMARY KEY, slug TEXT, status TEXT)`);
  db.exec(`INSERT INTO plugins (slug, status) VALUES ('old', 'approved')`);
  ensureSchema(db);
  const cols = (db.prepare(`PRAGMA table_info(plugins)`).all() as { name: string }[]).map((c) => c.name);
  expect(cols).toContain("verified_at");
  expect(cols).toContain("verified_by");
  const row = db.prepare(`SELECT verified_at, verified_by FROM plugins WHERE slug='old'`).get() as { verified_at: unknown; verified_by: unknown };
  expect(row.verified_at).toBeNull();
  expect(row.verified_by).toBeNull();
});

test("ensureSchema: second call doesn't throw", () => {
  const db = new DatabaseSync(":memory:");
  ensureSchema(db);
  expect(() => ensureSchema(db)).not.toThrow();
});
