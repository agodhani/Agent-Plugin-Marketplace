import type { DatabaseSync } from "node:sqlite";
import { getDb } from "./db";
import { WINDOW_MS, type FailureStore } from "./rate-limit";

const APPEND_SQL = `INSERT INTO rate_limits (bucket, events) VALUES (?, json_array(?))
  ON CONFLICT(bucket) DO UPDATE SET events = json_insert(
    (SELECT COALESCE(json_group_array(value), json_array()) FROM json_each(rate_limits.events) WHERE value > ?),
    '$[#]', ?)`;

export function createDbStore(db: () => DatabaseSync): { email: FailureStore; ip: FailureStore } {
  const get = (bucket: string): number[] => {
    const row = db().prepare(`SELECT events FROM rate_limits WHERE bucket = ?`).get(bucket) as { events: string } | undefined;
    if (!row) return [];
    try {
      return JSON.parse(row.events);
    } catch {
      return [];
    }
  };
  /** Atomic append + prune — no read-modify-write race between processes. */
  const append = (bucket: string, ts: number) => {
    db().prepare(APPEND_SQL).run(bucket, ts, ts - WINDOW_MS, ts);
  };
  const put = (bucket: string, events: number[]) => {
    db()
      .prepare(`INSERT INTO rate_limits (bucket, events) VALUES (?, ?) ON CONFLICT(bucket) DO UPDATE SET events = excluded.events`)
      .run(bucket, JSON.stringify(events));
  };
  const mk = (prefix: string): FailureStore => ({
    get: (k) => get(`${prefix}:${k}`),
    append: (k, ts) => append(`${prefix}:${k}`, ts),
    clear: (k) => put(`${prefix}:${k}`, []),
  });
  return { email: mk("email"), ip: mk("ip") };
}

// State lives in SQLite (like sessions): shared by every server process and
// durable across restarts.
export const dbStore = createDbStore(getDb);
