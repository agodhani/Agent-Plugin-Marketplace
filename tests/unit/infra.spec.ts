import { test, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { adminToggleEnabled, demoSeedEnabled } from "../../lib/flags";
import { clearLoginFailures, loginBlocked, recordLoginFailure } from "../../lib/rate-limit";
import { tx } from "../../lib/db";
import { createDbStore } from "../../lib/rate-limit-store";
import { WINDOW_MS } from "../../lib/rate-limit";

test("flags env permutations", () => {
  expect(adminToggleEnabled({})).toBe(true); // dev default
  expect(adminToggleEnabled({ NODE_ENV: "production" })).toBe(false);
  expect(adminToggleEnabled({ NODE_ENV: "production", ALLOW_ADMIN_TOGGLE: "1" })).toBe(true);
  expect(demoSeedEnabled({})).toBe(true);
  expect(demoSeedEnabled({ NODE_ENV: "production" })).toBe(false);
  expect(demoSeedEnabled({ NODE_ENV: "production", SEED_DEMO_DATA: "1" })).toBe(true);
});

test("rate limiter: 5 failures lock, correct behavior on window + success", () => {
  let now = 1_000_000;
  const email = `u${now}@x.dev`;
  for (let i = 0; i < 5; i++) recordLoginFailure(email, "10.0.0.9", now);
  expect(loginBlocked(email, "10.0.0.10", now)).toBe(true); // email locked regardless of ip
  clearLoginFailures(email);
  expect(loginBlocked(email, "10.0.0.10", now)).toBe(false);
  // window expiry
  for (let i = 0; i < 5; i++) recordLoginFailure(email, "10.0.0.9", now);
  now += 15 * 60_000 + 1;
  expect(loginBlocked(email, "10.0.0.9", now)).toBe(false);
});

test("rate limiter: 100 failures per IP lock", () => {
  const now = 2_000_000;
  for (let i = 0; i < 100; i++) recordLoginFailure(`ip${i}@x.dev`, "10.1.2.3", now);
  expect(loginBlocked("fresh@x.dev", "10.1.2.3", now)).toBe(true);
});

test("tx: rollback on throw, nested join, promise guard", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)");
  expect(() =>
    tx(() => {
      db.prepare("INSERT INTO t (v) VALUES ('a')").run();
      throw new Error("boom");
    }, db)
  ).toThrow("boom");
  expect(db.prepare("SELECT COUNT(*) c FROM t").get()).toEqual({ c: 0 });
  // nested joins outer
  tx(() => {
    db.prepare("INSERT INTO t (v) VALUES ('b')").run();
    tx(() => db.prepare("INSERT INTO t (v) VALUES ('c')").run(), db);
  }, db);
  expect(db.prepare("SELECT COUNT(*) c FROM t").get()).toEqual({ c: 2 });
  // promise guard
  expect(() => tx(() => Promise.resolve(1) as unknown as number, db)).toThrow();
});

test("db store: prunes old timestamps on append, keeps in-window, clear empties", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE rate_limits (bucket TEXT PRIMARY KEY, events TEXT NOT NULL DEFAULT '[]')");
  const store = createDbStore(() => db);
  const now = Date.now();
  const old = now - WINDOW_MS - 1000;
  db.prepare(`INSERT INTO rate_limits (bucket, events) VALUES ('email:x', ?)`).run(JSON.stringify([old, now - 1000]));
  store.email.append("x", now);
  const events = store.email.get("x");
  expect(events).toEqual([now - 1000, now]); // old dropped, in-window kept
  store.email.clear("x");
  expect(store.email.get("x")).toEqual([]);
});
