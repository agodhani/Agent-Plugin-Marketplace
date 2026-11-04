"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, tx } from "./db";
import { adminToggleEnabled } from "./flags";
import { createSession, destroySession, requireAdmin, requireUser } from "./auth";
import { hashPassword, verifyPassword } from "./password";
import { audit } from "./audit";
import { loginBlocked, recordLoginFailure, clearLoginFailures } from "./rate-limit";
import { dbStore } from "./rate-limit-store";
import { createToken, revokeToken } from "./tokens";
import { verificationBlockReason } from "./verification";
import { now, slugify } from "./utils";

export interface ActionState {
  error?: string;
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

// ---------------- auth ----------------

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = str(formData.get("email")).toLowerCase();
  const password = str(formData.get("password"));
  if (!email || !password) return { error: "Email and password are required." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",").pop()?.trim() || "local";
  if (loginBlocked(email, ip, Date.now(), dbStore)) {
    return { error: "Too many failed sign-in attempts. Try again in 15 minutes." };
  }
  const user = getDb()
    .prepare(`SELECT id, password_hash FROM users WHERE email = ?`)
    .get(email) as { id: number; password_hash: string } | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    recordLoginFailure(email, ip, Date.now(), dbStore);
    return { error: "Invalid email or password." };
  }
  clearLoginFailures(email, dbStore.email);
  await createSession(user.id);
  redirect("/");
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = str(formData.get("name"));
  const email = str(formData.get("email")).toLowerCase();
  const password = str(formData.get("password"));
  if (name.length < 2) return { error: "Please enter your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Please enter a valid email." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  const db = getDb();
  if (db.prepare(`SELECT id FROM users WHERE email = ?`).get(email)) {
    return { error: "An account with that email already exists." };
  }
  const userId = tx(() => {
    const res = db
      .prepare(`INSERT INTO users (name, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, 0, ?)`)
      .run(name, email, hashPassword(password), now());
    const uid = Number(res.lastInsertRowid);
    audit({ id: uid, name }, "user_registered", "user", uid, name);
    return uid;
  });
  await createSession(userId);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function toggleAdminAction() {
  if (!adminToggleEnabled()) return { error: "Admin toggling is disabled — use npm run promote-admin -- <email>." };
  const user = await requireUser();
  tx(() => {
    getDb().prepare(`UPDATE users SET is_admin = ? WHERE id = ?`).run(user.is_admin ? 0 : 1, user.id);
    audit(user, "admin_toggled", "user", user.id, user.name, { is_admin: !user.is_admin });
  });
  revalidatePath("/profile");
}

// ---------------- teams ----------------

export async function createTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = str(formData.get("name"));
  const description = str(formData.get("description"));
  if (name.length < 2) return { error: "Team name is required." };
  const db = getDb();
  if (db.prepare(`SELECT id FROM teams WHERE name = ?`).get(name)) {
    return { error: "A team with that name already exists." };
  }
  const teamId = tx(() => {
    const res = db.prepare(`INSERT INTO teams (name, description, created_at) VALUES (?, ?, ?)`).run(name, description, now());
    const tid = Number(res.lastInsertRowid);
    db.prepare(`INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'admin')`).run(tid, user.id);
    audit(user, "team_created", "team", tid, name);
    return tid;
  });
  redirect("/teams");
}

export async function joinTeamAction(teamId: number) {
  const user = await requireUser();
  getDb().prepare(`INSERT OR IGNORE INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')`).run(teamId, user.id);
  revalidatePath("/teams");
}

export async function leaveTeamAction(teamId: number) {
  const user = await requireUser();
  getDb().prepare(`DELETE FROM team_members WHERE team_id = ? AND user_id = ?`).run(teamId, user.id);
  revalidatePath("/teams");
}

export async function setTeamUsageAction(pluginId: number, teamId: number, used: boolean) {
  const user = await requireUser();
  const db = getDb();
  const member = db.prepare(`SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?`).get(teamId, user.id);
  if (!member) return { error: "You are not a member of that team." };
  const team = db.prepare(`SELECT name FROM teams WHERE id = ?`).get(teamId) as { name: string } | undefined;
  const plugin = db.prepare(`SELECT name, status FROM plugins WHERE id = ?`).get(pluginId) as
    | { name: string; status: string }
    | undefined;
  if (used && (!plugin || plugin.status !== "approved")) return { error: "Plugin not found." };
  if (!plugin) return { error: "Plugin not found." };
  tx(() => {
    if (used) {
      db.prepare(`INSERT OR REPLACE INTO team_usage (team_id, plugin_id, marked_by, created_at) VALUES (?, ?, ?, ?)`).run(
        teamId, pluginId, user.id, now()
      );
      audit(user, "team_usage_added", "plugin", pluginId, plugin.name, { team: team?.name });
    } else {
      db.prepare(`DELETE FROM team_usage WHERE team_id = ? AND plugin_id = ?`).run(teamId, pluginId);
      audit(user, "team_usage_removed", "plugin", pluginId, plugin.name, { team: team?.name });
    }
  });
  revalidatePath("/");
  revalidatePath("/teams");
  return { ok: true };
}

// ---------------- review ----------------

export async function reviewAction(submissionId: number, decision: "approve" | "reject", notes: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (decision !== "approve" && decision !== "reject") return { error: "Invalid review decision." };
  const db = getDb();
  const sub = db.prepare(`SELECT * FROM submissions WHERE id = ?`).get(submissionId) as
    | { id: number; plugin_id: number; kind: string; version: string; changelog: string; status: string; file_path: string; manifest: string; submitted_by: number; risk_score: number; risk_level: string }
    | undefined;
  if (!sub) return { error: "Submission not found." };
  if (sub.status !== "pending") return { error: "This submission was already reviewed." };
  if (sub.submitted_by === admin.id) {
    return { error: "You can't review your own submission — another admin must approve or reject it." };
  }

  const plugin = db.prepare(`SELECT id, name, slug FROM plugins WHERE id = ?`).get(sub.plugin_id) as
    | { id: number; name: string; slug: string }
    | undefined;
  if (!plugin) return { error: "Plugin no longer exists." };

  tx(() => {
    if (decision === "approve") {
      if (sub.kind === "new") {
      db.prepare(`UPDATE plugins SET status = 'approved', updated_at = ? WHERE id = ?`).run(now(), plugin.id);
    } else {
      const existing = db.prepare(`SELECT 1 FROM versions WHERE plugin_id = ? AND version = ?`).get(plugin.id, sub.version);
      if (!existing) {
        db.prepare(
          `INSERT INTO versions (plugin_id, version, changelog, file_path, manifest, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(plugin.id, sub.version, sub.changelog, sub.file_path, sub.manifest, sub.submitted_by, now());
      }
      db.prepare(`UPDATE plugins SET current_version = ?, risk_level = ?, risk_score = ?, updated_at = ? WHERE id = ?`)
        .run(sub.version, sub.risk_level, sub.risk_score, now(), plugin.id);
      audit(admin, "version_published", "plugin", plugin.id, plugin.name, { version: sub.version });
    }
    db.prepare(`UPDATE submissions SET status = 'approved', reviewer_id = ?, review_notes = ?, reviewed_at = ? WHERE id = ?`)
      .run(admin.id, notes, now(), sub.id);
    audit(admin, "submission_approved", "submission", sub.id, plugin.name, { version: sub.version, kind: sub.kind, notes });
  } else {
    if (sub.kind === "new") {
      db.prepare(`UPDATE plugins SET status = 'rejected', updated_at = ? WHERE id = ?`).run(now(), plugin.id);
    }
    db.prepare(`UPDATE submissions SET status = 'rejected', reviewer_id = ?, review_notes = ?, reviewed_at = ? WHERE id = ?`)
      .run(admin.id, notes, now(), sub.id);
      audit(admin, "submission_rejected", "submission", sub.id, plugin.name, { version: sub.version, kind: sub.kind, notes });
    }
  });

  revalidatePath("/admin");
  revalidatePath(`/plugins/${plugin.slug}`);
  redirect("/admin");
}

// ---------------- playbooks ----------------

function uniquePlaybookSlug(name: string): string {
  const db = getDb();
  const base = slugify(name) || "playbook";
  let slug = base;
  let i = 2;
  while (db.prepare(`SELECT id FROM playbooks WHERE slug = ?`).get(slug)) slug = `${base}-${i++}`;
  return slug;
}

function canEditPlaybook(userId: number, isAdmin: number, playbookId: number): boolean {
  const pb = getDb().prepare(`SELECT author_id FROM playbooks WHERE id = ?`).get(playbookId) as { author_id: number } | undefined;
  return !!pb && (pb.author_id === userId || !!isAdmin);
}

function pluginIdsFrom(formData: FormData): number[] {
  return formData
    .getAll("items")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** Keep only approved plugin IDs, preserving input order and removing dupes. */
function approvedPluginIds(ids: number[]): number[] {
  if (!ids.length) return [];
  const seen = new Set<number>();
  const deduped = ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
  const rows = getDb()
    .prepare(`SELECT id FROM plugins WHERE status = 'approved' AND id IN (${deduped.map(() => "?").join(",")})`)
    .all(...deduped) as unknown as { id: number }[];
  const valid = new Set(rows.map((r) => r.id));
  return deduped.filter((id) => valid.has(id));
}

export async function createPlaybookAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = str(formData.get("name"));
  const description = str(formData.get("description"));
  const items = approvedPluginIds(pluginIdsFrom(formData));
  if (name.length < 3) return { error: "Playbook name is required (3+ characters)." };
  if (items.length === 0) return { error: "Pick at least one plugin for the playbook." };

  const db = getDb();
  const slug = uniquePlaybookSlug(name);
  const pbId = tx(() => {
    const res = db
      .prepare(`INSERT INTO playbooks (slug, name, description, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(slug, name, description, user.id, now(), now());
    const id = Number(res.lastInsertRowid);
    const insItem = db.prepare(
      `INSERT OR IGNORE INTO playbook_items (playbook_id, plugin_id, position, added_by, created_at) VALUES (?, ?, ?, ?, ?)`
    );
    items.forEach((pluginId, i) => insItem.run(id, pluginId, i, user.id, now()));
    audit(user, "playbook_created", "playbook", id, name, { items: items.length });
    return id;
  });
  redirect(`/playbooks/${slug}`);
}

export async function updatePlaybookAction(playbookId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!canEditPlaybook(user.id, user.is_admin, playbookId)) return { error: "Only the author or an admin can edit this playbook." };
  const name = str(formData.get("name"));
  const description = str(formData.get("description"));
  const items = approvedPluginIds(pluginIdsFrom(formData));
  if (name.length < 3) return { error: "Playbook name is required (3+ characters)." };
  if (items.length === 0) return { error: "Pick at least one plugin for the playbook." };

  const db = getDb();
  const pb = tx(() => {
    db.prepare(`UPDATE playbooks SET name = ?, description = ?, updated_at = ? WHERE id = ?`).run(name, description, now(), playbookId);
    db.prepare(`DELETE FROM playbook_items WHERE playbook_id = ?`).run(playbookId);
    const insItem = db.prepare(
      `INSERT OR IGNORE INTO playbook_items (playbook_id, plugin_id, position, added_by, created_at) VALUES (?, ?, ?, ?, ?)`
    );
    items.forEach((pluginId, i) => insItem.run(playbookId, pluginId, i, user.id, now()));
    const row = db.prepare(`SELECT slug, name FROM playbooks WHERE id = ?`).get(playbookId) as { slug: string; name: string };
    audit(user, "playbook_updated", "playbook", playbookId, row.name, { items: items.length });
    return row;
  });
  redirect(`/playbooks/${pb.slug}`);
}

export async function deletePlaybookAction(playbookId: number) {
  const user = await requireUser();
  if (!canEditPlaybook(user.id, user.is_admin, playbookId)) return { error: "Only the author or an admin can delete this playbook." };
  const pb = getDb().prepare(`SELECT name FROM playbooks WHERE id = ?`).get(playbookId) as { name: string } | undefined;
  tx(() => {
    getDb().prepare(`DELETE FROM playbooks WHERE id = ?`).run(playbookId);
    audit(user, "playbook_deleted", "playbook", playbookId, pb?.name ?? "playbook");
  });
  redirect("/playbooks");
}

export async function togglePlaybookItemAction(playbookId: number, pluginId: number, add: boolean) {
  const user = await requireUser();
  if (!canEditPlaybook(user.id, user.is_admin, playbookId)) return { error: "Only the author or an admin can change this playbook." };
  const db = getDb();
  const pb = db.prepare(`SELECT name FROM playbooks WHERE id = ?`).get(playbookId) as { name: string } | undefined;
  const plugin = db.prepare(`SELECT name, status FROM plugins WHERE id = ?`).get(pluginId) as
    | { name: string; status: string }
    | undefined;
  if (!plugin) return { error: "Plugin not found." };
  if (add && plugin.status !== "approved") return { error: "Only published plugins can be added to a playbook." };
  tx(() => {
    if (add) {
      const max = db.prepare(`SELECT COALESCE(MAX(position), 0) m FROM playbook_items WHERE playbook_id = ?`).get(playbookId) as { m: number };
      db.prepare(
        `INSERT OR IGNORE INTO playbook_items (playbook_id, plugin_id, position, added_by, created_at) VALUES (?, ?, ?, ?, ?)`
      ).run(playbookId, pluginId, max.m + 1, user.id, now());
      audit(user, "playbook_item_added", "playbook", playbookId, pb?.name ?? "", { plugin: plugin.name });
    } else {
      db.prepare(`DELETE FROM playbook_items WHERE playbook_id = ? AND plugin_id = ?`).run(playbookId, pluginId);
      audit(user, "playbook_item_removed", "playbook", playbookId, pb?.name ?? "", { plugin: plugin.name });
    }
    db.prepare(`UPDATE playbooks SET updated_at = ? WHERE id = ?`).run(now(), playbookId);
  });
  revalidatePath(`/playbooks`);
  return { ok: true };
}

export async function createPlaybookFromTrayAction(name: string, pluginIds: number[]): Promise<{ slug?: string; error?: string }> {
  const user = await requireUser();
  const cleanName = name.trim();
  if (cleanName.length < 3) return { error: "Name needs 3+ characters." };
  const valid = approvedPluginIds(pluginIds.filter((n) => Number.isInteger(n) && n > 0));
  if (!valid.length) return { error: "No valid catalog items selected." };
  const db = getDb();
  const slug = uniquePlaybookSlug(cleanName);
  tx(() => {
    const res = db
      .prepare(`INSERT INTO playbooks (slug, name, description, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(slug, cleanName, `Saved from the install tray — ${valid.length} item(s).`, user.id, now(), now());
    const pbId = Number(res.lastInsertRowid);
    const insItem = db.prepare(
      `INSERT OR IGNORE INTO playbook_items (playbook_id, plugin_id, position, added_by, created_at) VALUES (?, ?, ?, ?, ?)`
    );
    valid.forEach((pid, i) => insItem.run(pbId, pid, i, user.id, now()));
    audit(user, "playbook_created", "playbook", pbId, cleanName, { items: valid.length, source: "tray" });
  });
  return { slug };
}

export async function upsertReviewAction(pluginId: number, rating: number, body: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Pick a rating from 1 to 5 stars." };
  const db = getDb();
  const p = db.prepare(`SELECT name, slug, status FROM plugins WHERE id = ?`).get(pluginId) as
    | { name: string; slug: string; status: string }
    | undefined;
  if (!p || p.status !== "approved") return { error: "Plugin not found." };
  tx(() => {
    db.prepare(
      `INSERT INTO reviews (plugin_id, user_id, rating, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(plugin_id, user_id) DO UPDATE SET rating = excluded.rating, body = excluded.body, updated_at = excluded.updated_at`
    ).run(pluginId, user.id, rating, body.trim(), now(), now());
    audit(user, "review_posted", "plugin", pluginId, p.name, { rating });
  });
  revalidatePath(`/plugins/${p.slug}`);
  return { ok: true };
}

export async function setPluginVerifiedAction(pluginId: number, verified: boolean): Promise<{ error?: string; ok?: boolean }> {
  const admin = await requireAdmin();
  if (!Number.isInteger(pluginId) || typeof verified !== "boolean") return { error: "Invalid request." };
  const db = getDb();
  const p = db.prepare(`SELECT id, name, slug, status, author_id, verified_at FROM plugins WHERE id = ?`).get(pluginId) as
    | { id: number; name: string; slug: string; status: string; author_id: number; verified_at: string | null }
    | undefined;
  if (!p) return { error: "Plugin not found." };
  const reason = verificationBlockReason(p, admin, verified);
  if (reason) return { error: reason };
  if (!!p.verified_at === verified) return { ok: true };
  tx(() => {
    db.prepare(`UPDATE plugins SET verified_at = ?, verified_by = ? WHERE id = ?`).run(verified ? now() : null, verified ? admin.id : null, p.id);
    audit(admin, verified ? "plugin_verified" : "plugin_unverified", "plugin", p.id, p.name);
  });
  revalidatePath("/");
  revalidatePath(`/plugins/${p.slug}`);
  return { ok: true };
}

export async function createTokenAction(name: string): Promise<{ token?: string; error?: string }> {
  const user = await requireUser();
  const clean = (name ?? "").trim();
  let res: { token: string } | { error: string } | undefined;
  tx(() => {
    res = createToken(user.id, clean);
    if ("error" in res) return;
    audit(user, "token_created", "user", user.id, user.name, { name: clean, prefix: res.token.slice(0, 12) });
  });
  if (!res || "error" in res) return { error: res?.error ?? "Could not create token." };
  revalidatePath("/profile");
  return { token: res.token };
}

export async function revokeTokenAction(id: number): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  if (!Number.isInteger(id)) return { error: "Invalid request." };
  const row = getDb().prepare(`SELECT name, prefix FROM api_tokens WHERE id = ? AND user_id = ?`).get(id, user.id) as
    | { name: string; prefix: string }
    | undefined;
  if (!row) return { error: "Token not found." };
  tx(() => {
    revokeToken(user.id, id);
    audit(user, "token_revoked", "user", user.id, user.name, { name: row.name, prefix: row.prefix });
  });
  revalidatePath("/profile");
  return { ok: true };
}
