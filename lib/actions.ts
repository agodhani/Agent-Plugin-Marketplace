"use server";

import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import JSZip from "jszip";
import { getDb, UPLOAD_DIR } from "./db";
import { createSession, destroySession, getCurrentUser, requireAdmin, requireUser } from "./auth";
import { hashPassword, verifyPassword } from "./password";
import { audit } from "./audit";
import { isTextFile, runScans, type ExtractedFile, type SubmitMeta } from "./scan";
import { now, slugify } from "./utils";

export interface ActionState {
  error?: string;
}

const MAX_UPLOAD = 50 * 1024 * 1024;
const MAX_FILES = 500;
const MAX_SCAN_BYTES = 512 * 1024;

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

// ---------------- auth ----------------

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = str(formData.get("email")).toLowerCase();
  const password = str(formData.get("password"));
  if (!email || !password) return { error: "Email and password are required." };
  const user = getDb()
    .prepare(`SELECT id, password_hash FROM users WHERE email = ?`)
    .get(email) as { id: number; password_hash: string } | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "Invalid email or password." };
  }
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
  const res = db
    .prepare(`INSERT INTO users (name, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, 0, ?)`)
    .run(name, email, hashPassword(password), now());
  const userId = Number(res.lastInsertRowid);
  audit({ id: userId, name }, "user_registered", "user", userId, name);
  await createSession(userId);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function toggleAdminAction() {
  const user = await requireUser();
  getDb().prepare(`UPDATE users SET is_admin = ? WHERE id = ?`).run(user.is_admin ? 0 : 1, user.id);
  audit(user, "admin_toggled", "user", user.id, user.name, { is_admin: !user.is_admin });
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
  const res = db.prepare(`INSERT INTO teams (name, description, created_at) VALUES (?, ?, ?)`).run(name, description, now());
  const teamId = Number(res.lastInsertRowid);
  db.prepare(`INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'admin')`).run(teamId, user.id);
  audit(user, "team_created", "team", teamId, name);
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

export async function setTeamUsageAction(pluginId: number, teamId: number, used: boolean, pluginName: string) {
  const user = await requireUser();
  const db = getDb();
  const member = db.prepare(`SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?`).get(teamId, user.id);
  if (!member) return { error: "You are not a member of that team." };
  const team = db.prepare(`SELECT name FROM teams WHERE id = ?`).get(teamId) as { name: string } | undefined;
  if (used) {
    db.prepare(`INSERT OR REPLACE INTO team_usage (team_id, plugin_id, marked_by, created_at) VALUES (?, ?, ?, ?)`).run(
      teamId, pluginId, user.id, now()
    );
    audit(user, "team_usage_added", "plugin", pluginId, pluginName, { team: team?.name });
  } else {
    db.prepare(`DELETE FROM team_usage WHERE team_id = ? AND plugin_id = ?`).run(teamId, pluginId);
    audit(user, "team_usage_removed", "plugin", pluginId, pluginName, { team: team?.name });
  }
  revalidatePath("/");
  revalidatePath("/teams");
  return { ok: true };
}

// ---------------- submissions ----------------

async function extractUpload(file: File): Promise<{ files: ExtractedFile[]; storedPath: string }> {
  const buf = Buffer.from(await file.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  const files: ExtractedFile[] = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (files.length >= MAX_FILES) break;
    const raw = Buffer.from(await entry.async("uint8array"));
    files.push({
      name,
      size: raw.length,
      text: isTextFile(name) && raw.length <= MAX_SCAN_BYTES ? raw.toString("utf8") : null,
    });
  }
  const storedPath = path.join(UPLOAD_DIR, `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.zip`);
  fs.writeFileSync(storedPath, buf);
  return { files, storedPath };
}

function uniqueSlug(name: string): string {
  const db = getDb();
  const base = slugify(name) || "plugin";
  let slug = base;
  let i = 2;
  while (db.prepare(`SELECT id FROM plugins WHERE slug = ?`).get(slug)) slug = `${base}-${i++}`;
  return slug;
}

function readMeta(formData: FormData): SubmitMeta {
  return {
    name: str(formData.get("name")),
    type: str(formData.get("type")) || "plugin",
    version: str(formData.get("version")) || "1.0.0",
    summary: str(formData.get("summary")),
    permissions: formData.getAll("permissions").filter((p): p is string => typeof p === "string"),
  };
}

export async function submitPluginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const meta = readMeta(formData);

  const file = formData.get("file");
  let files: ExtractedFile[] = [];
  let storedPath = "";
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD) return { error: "Archive exceeds the 50 MB limit." };
    try {
      ({ files, storedPath } = await extractUpload(file));
    } catch {
      return { error: "Could not read the uploaded file — please upload a valid .zip archive." };
    }
  }

  const report = runScans(files, meta);
  if (!report.ok) {
    const failed = report.validation.filter((c) => c.severity === "error" && !c.passed).map((c) => c.label);
    return { error: `Validation failed: ${failed.join(", ")}.` };
  }

  const db = getDb();
  const slug = uniqueSlug(meta.name);
  const about = str(formData.get("about"));
  const readme = str(formData.get("readme"));
  const faq = str(formData.get("faq")) || "[]";
  const install = str(formData.get("install_command")) || `amp install ${slug}`;
  const changelog = str(formData.get("changelog")) || "Initial release.";
  const tags = str(formData.get("tags"))
    .split(",")
    .map((t) => slugify(t))
    .filter(Boolean)
    .slice(0, 12);

  const res = db
    .prepare(
      `INSERT INTO plugins (slug, name, type, summary, about, readme, faq, permissions, risk_level, risk_score,
         status, author_id, current_version, install_command, downloads, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 0, ?, ?)`
    )
    .run(slug, meta.name, meta.type, meta.summary, about, readme, faq, JSON.stringify(meta.permissions),
      report.level, report.score, user.id, meta.version, install, now(), now());
  const pluginId = Number(res.lastInsertRowid);
  const insTag = db.prepare(`INSERT OR IGNORE INTO plugin_tags (plugin_id, tag) VALUES (?, ?)`);
  for (const t of tags) insTag.run(pluginId, t);

  db.prepare(
    `INSERT INTO versions (plugin_id, version, changelog, file_path, manifest, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(pluginId, meta.version, changelog, storedPath, JSON.stringify(report.manifest ?? {}), user.id, now());

  const subRes = db
    .prepare(
      `INSERT INTO submissions (plugin_id, submitted_by, kind, version, changelog, status, validation_report,
         security_report, risk_score, risk_level, manifest, file_path, created_at)
       VALUES (?, ?, 'new', ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(pluginId, user.id, meta.version, changelog, JSON.stringify(report.validation), JSON.stringify(report.findings),
      report.score, report.level, JSON.stringify(report.manifest ?? {}), storedPath, now());

  audit(user, "plugin_submitted", "plugin", pluginId, meta.name, { version: meta.version, submissionId: Number(subRes.lastInsertRowid) });
  redirect(`/plugins/${slug}`);
}

export async function submitVersionAction(pluginId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const db = getDb();
  const plugin = db.prepare(`SELECT * FROM plugins WHERE id = ?`).get(pluginId) as { id: number; name: string; slug: string; type: string; author_id: number; summary: string } | undefined;
  if (!plugin) return { error: "Plugin not found." };
  if (plugin.author_id !== user.id && !user.is_admin) return { error: "Only the author or an admin can submit a new version." };

  const version = str(formData.get("version"));
  const changelog = str(formData.get("changelog"));
  if (!/^\d+\.\d+\.\d+/.test(version)) return { error: "Version must look like semver (e.g. 1.2.0)." };
  if (changelog.length < 5) return { error: "Please describe what changed." };
  if (db.prepare(`SELECT 1 FROM versions WHERE plugin_id = ? AND version = ?`).get(pluginId, version)) {
    return { error: `Version ${version} already exists.` };
  }

  const file = formData.get("file");
  let files: ExtractedFile[] = [];
  let storedPath = "";
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD) return { error: "Archive exceeds the 50 MB limit." };
    try {
      ({ files, storedPath } = await extractUpload(file));
    } catch {
      return { error: "Could not read the uploaded file — please upload a valid .zip archive." };
    }
  }

  const pluginMeta = db.prepare(`SELECT permissions FROM plugins WHERE id = ?`).get(pluginId) as { permissions: string };
  let perms: string[] = [];
  try {
    perms = JSON.parse(pluginMeta.permissions);
  } catch { /* ignore */ }

  const meta: SubmitMeta = { name: plugin.name, type: plugin.type, version, summary: plugin.summary || plugin.name, permissions: perms };
  const report = runScans(files, meta);
  if (!report.ok) {
    const failed = report.validation.filter((c) => c.severity === "error" && !c.passed).map((c) => c.label);
    return { error: `Validation failed: ${failed.join(", ")}.` };
  }

  db.prepare(
    `INSERT INTO submissions (plugin_id, submitted_by, kind, version, changelog, status, validation_report,
       security_report, risk_score, risk_level, manifest, file_path, created_at)
     VALUES (?, ?, 'version', ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`
  ).run(pluginId, user.id, version, changelog, JSON.stringify(report.validation), JSON.stringify(report.findings),
    report.score, report.level, JSON.stringify(report.manifest ?? {}), storedPath, now());

  audit(user, "version_submitted", "plugin", pluginId, plugin.name, { version });
  redirect(`/plugins/${plugin.slug}`);
}

// ---------------- review ----------------

export async function reviewAction(submissionId: number, decision: "approve" | "reject", notes: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const db = getDb();
  const sub = db.prepare(`SELECT * FROM submissions WHERE id = ?`).get(submissionId) as
    | { id: number; plugin_id: number; kind: string; version: string; changelog: string; status: string; file_path: string; manifest: string; submitted_by: number; risk_score: number; risk_level: string }
    | undefined;
  if (!sub) return { error: "Submission not found." };
  if (sub.status !== "pending") return { error: "This submission was already reviewed." };

  const plugin = db.prepare(`SELECT id, name, slug FROM plugins WHERE id = ?`).get(sub.plugin_id) as
    | { id: number; name: string; slug: string }
    | undefined;
  if (!plugin) return { error: "Plugin no longer exists." };

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

  revalidatePath("/admin");
  revalidatePath(`/plugins/${plugin.slug}`);
  redirect("/admin");
}
