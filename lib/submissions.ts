import fs from "node:fs";
import path from "node:path";
import { getDb, tx, UPLOAD_DIR } from "./db";
import { audit } from "./audit";
import { LIMITS, runScans, toExtractedFiles, type ExtractedFile, type SubmitMeta } from "./scan";
import { now, SEMVER, slugify } from "./utils";
import { readZip, ZipError } from "./zipstore";
import type { SessionUser } from "./auth";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

type Result = { slug: string } | { error: string; status?: number };

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
    installCommand: str(formData.get("install_command")),
  };
}

async function extractUpload(file: File): Promise<{ files: ExtractedFile[]; buf: Buffer }> {
  const buf = Buffer.from(await file.arrayBuffer());
  const entries = readZip(buf, { maxEntries: LIMITS.maxFiles, maxTotalBytes: LIMITS.maxUncompressedBytes });
  return { files: toExtractedFiles(entries), buf };
}

function archiveError(e: unknown): { error: string } {
  if (e instanceof ZipError) return { error: `Could not read the uploaded archive: ${e.message}` };
  return { error: "Could not read the uploaded archive — please upload a valid .zip file." };
}

export async function submitPlugin(user: SessionUser, formData: FormData): Promise<Result> {
  const meta = readMeta(formData);

  const file = formData.get("file");
  let files: ExtractedFile[] = [];
  let buf: Buffer | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > LIMITS.maxUploadBytes) return { error: "Archive exceeds the 50 MB limit." };
    try {
      ({ files, buf } = await extractUpload(file));
    } catch (e) {
      return archiveError(e);
    }
  }

  const report = runScans(files, meta);
  if (!report.ok) {
    const failed = report.validation.filter((c) => c.severity === "error" && !c.passed).map((c) => c.label);
    return { error: `Validation failed: ${failed.join(", ")}.` };
  }

  // Validation passed — persist the upload, then commit all DB writes in one tx.
  let storedPath = "";
  if (buf) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    storedPath = path.join(UPLOAD_DIR, `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.zip`);
    fs.writeFileSync(storedPath, buf);
  }

  const db = getDb();
  const slug = uniqueSlug(meta.name);
  const about = str(formData.get("about"));
  const readme = str(formData.get("readme"));
  const faq = str(formData.get("faq")) || "[]";
  const install = meta.installCommand || `amp install ${slug}`;
  const changelog = str(formData.get("changelog")) || "Initial release.";
  const tags = str(formData.get("tags"))
    .split(",")
    .map((t) => slugify(t))
    .filter(Boolean)
    .slice(0, 12);

  try {
    tx(() => {
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
    });
  } catch (e) {
    if (storedPath) fs.rmSync(storedPath, { force: true });
    throw e;
  }
  return { slug };
}

export async function submitVersion(user: SessionUser, pluginId: number, formData: FormData): Promise<Result> {
  const db = getDb();
  const plugin = db.prepare(`SELECT * FROM plugins WHERE id = ?`).get(pluginId) as
    | { id: number; name: string; slug: string; type: string; author_id: number; summary: string }
    | undefined;
  if (!plugin) return { error: "Plugin not found.", status: 404 };
  if (plugin.author_id !== user.id && !user.is_admin) {
    return { error: "Only the author or an admin can submit a new version.", status: 403 };
  }

  const version = str(formData.get("version"));
  const changelog = str(formData.get("changelog"));
  if (!SEMVER.test(version)) return { error: "Version must look like semver (e.g. 1.2.0)." };
  if (changelog.length < 5) return { error: "Please describe what changed." };
  if (db.prepare(`SELECT 1 FROM versions WHERE plugin_id = ? AND version = ?`).get(pluginId, version)) {
    return { error: `Version ${version} already exists.` };
  }

  const file = formData.get("file");
  let files: ExtractedFile[] = [];
  let buf: Buffer | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > LIMITS.maxUploadBytes) return { error: "Archive exceeds the 50 MB limit." };
    try {
      ({ files, buf } = await extractUpload(file));
    } catch (e) {
      return archiveError(e);
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

  let storedPath = "";
  if (buf) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    storedPath = path.join(UPLOAD_DIR, `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.zip`);
    fs.writeFileSync(storedPath, buf);
  }

  try {
    tx(() => {
      db.prepare(
        `INSERT INTO submissions (plugin_id, submitted_by, kind, version, changelog, status, validation_report,
           security_report, risk_score, risk_level, manifest, file_path, created_at)
         VALUES (?, ?, 'version', ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`
      ).run(pluginId, user.id, version, changelog, JSON.stringify(report.validation), JSON.stringify(report.findings),
        report.score, report.level, JSON.stringify(report.manifest ?? {}), storedPath, now());
      audit(user, "version_submitted", "plugin", pluginId, plugin.name, { version });
    });
  } catch (e) {
    if (storedPath) fs.rmSync(storedPath, { force: true });
    throw e;
  }
  return { slug: plugin.slug };
}
