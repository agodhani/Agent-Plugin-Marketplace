#!/usr/bin/env node
// Promote a user to admin:  npm run promote-admin -- <email>
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run promote-admin -- <email>");
  process.exit(1);
}
const dir = process.env.MARKETPLACE_DATA_DIR ? path.resolve(process.env.MARKETPLACE_DATA_DIR) : path.join(process.cwd(), "data");
const dbPath = path.join(dir, "marketplace.db");
if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath} — start the app once first (or set MARKETPLACE_DATA_DIR).`);
  process.exit(1);
}
const db = new DatabaseSync(dbPath);
const user = db.prepare(`SELECT id, name, is_admin FROM users WHERE email = ?`).get(email);
if (!user) {
  console.error(`No user with email ${email}.`);
  process.exit(1);
}
db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(user.id);
db.prepare(
  `INSERT INTO audit_log (actor_id, actor_name, action, entity_type, entity_id, entity_name, details, created_at)
   VALUES (NULL, 'system', 'admin_granted', 'user', ?, ?, '{}', ?)`
).run(user.id, user.name, new Date().toISOString());
console.log(`Granted admin access to ${user.name} <${email}>.`);
