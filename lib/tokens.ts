import { randomBytes, createHash } from "node:crypto";
import { getDb } from "./db";
import { now } from "./utils";
import type { SessionUser } from "./auth";

export const TOKEN_TTL_MS = 90 * 86400_000;
export const MAX_ACTIVE_TOKENS = 10;

export function generateToken(): string {
  return "ahp_" + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createToken(userId: number, name: string): { token: string } | { error: string } {
  const clean = name.trim();
  if (clean.length < 1 || clean.length > 60) return { error: "Token name must be 1–60 characters." };
  const db = getDb();
  const active = db
    .prepare(`SELECT COUNT(*) c FROM api_tokens WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?`)
    .get(userId, now()) as { c: number };
  if (active.c >= MAX_ACTIVE_TOKENS) return { error: "You have 10 active tokens — revoke one first." };
  const token = generateToken();
  db.prepare(
    `INSERT INTO api_tokens (user_id, name, token_hash, prefix, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, clean, hashToken(token), token.slice(0, 12), now(), new Date(Date.now() + TOKEN_TTL_MS).toISOString());
  return { token };
}

export function userForToken(token: string): SessionUser | null {
  if (!token || !token.startsWith("ahp_")) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT t.id AS token_id, u.id, u.name, u.email, u.is_admin FROM api_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.revoked_at IS NULL AND t.expires_at > ?`
    )
    .get(hashToken(token), now()) as unknown as (SessionUser & { token_id: number }) | undefined;
  if (!row) return null;
  db.prepare(`UPDATE api_tokens SET last_used_at = ? WHERE id = ?`).run(now(), row.token_id);
  return { id: row.id, name: row.name, email: row.email, is_admin: row.is_admin };
}

export function listTokens(userId: number) {
  return getDb()
    .prepare(
      `SELECT id, name, prefix, created_at, expires_at, last_used_at FROM api_tokens
       WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`
    )
    .all(userId) as { id: number; name: string; prefix: string; created_at: string; expires_at: string; last_used_at: string | null }[];
}

export function revokeToken(userId: number, id: number): boolean {
  const r = getDb()
    .prepare(`UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`)
    .run(now(), id, userId);
  return Number(r.changes) > 0;
}
