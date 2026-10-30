import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { seedIfEmpty } from "./seed";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS team_members (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (team_id, user_id)
);
CREATE TABLE IF NOT EXISTS plugins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  readme TEXT NOT NULL DEFAULT '',
  faq TEXT NOT NULL DEFAULT '[]',
  permissions TEXT NOT NULL DEFAULT '[]',
  risk_level TEXT NOT NULL DEFAULT 'unknown',
  risk_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  author_id INTEGER REFERENCES users(id),
  current_version TEXT NOT NULL DEFAULT '1.0.0',
  install_command TEXT NOT NULL DEFAULT '',
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plugin_tags (
  plugin_id INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (plugin_id, tag)
);
CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plugin_id INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  changelog TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  manifest TEXT NOT NULL DEFAULT '{}',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plugin_id INTEGER REFERENCES plugins(id) ON DELETE CASCADE,
  submitted_by INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL DEFAULT 'new',
  version TEXT NOT NULL DEFAULT '1.0.0',
  changelog TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  validation_report TEXT NOT NULL DEFAULT '[]',
  security_report TEXT NOT NULL DEFAULT '[]',
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'unknown',
  manifest TEXT NOT NULL DEFAULT '{}',
  file_path TEXT NOT NULL DEFAULT '',
  reviewer_id INTEGER REFERENCES users(id),
  review_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS team_usage (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  plugin_id INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  marked_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (team_id, plugin_id)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id),
  actor_name TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  entity_name TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_versions_plugin ON versions(plugin_id);
`;

const globalForDb = globalThis as unknown as { __agenthubDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!globalForDb.__agenthubDb) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const db = new DatabaseSync(path.join(DATA_DIR, "marketplace.db"));
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(SCHEMA);
    // node:sqlite returns null-prototype rows; convert to plain objects so they
    // can cross the Server -> Client Component boundary in Next.js.
    const rawPrepare = db.prepare.bind(db);
    db.prepare = ((sql: string) => {
      const stmt = rawPrepare(sql);
      const all = stmt.all.bind(stmt);
      const get = stmt.get.bind(stmt);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stmt as any).all = (...a: unknown[]) => all(...a).map((r) => ({ ...r }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stmt as any).get = (...a: unknown[]) => {
        const r = get(...a);
        return r === undefined ? undefined : { ...r };
      };
      return stmt;
    }) as typeof db.prepare;

    globalForDb.__agenthubDb = db;
    seedIfEmpty(db, UPLOAD_DIR);
  }
  return globalForDb.__agenthubDb;
}
