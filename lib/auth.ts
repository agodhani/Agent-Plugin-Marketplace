import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { getDb } from "./db";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  is_admin: number;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get("session")?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.name, u.email, u.is_admin FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, new Date().toISOString()) as unknown as SessionUser | undefined;
  return row ?? null;
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  getDb()
    .prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
    .run(token, userId, new Date(Date.now() + 30 * 86400_000).toISOString());
  const store = await cookies();
  store.set("session", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get("session")?.value;
  if (token) getDb().prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  store.delete("session");
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.is_admin) redirect("/");
  return user;
}
