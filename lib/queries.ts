import { cache } from "react";
import { getDb } from "./db";

export interface PluginListItem {
  id: number;
  slug: string;
  name: string;
  type: string;
  summary: string;
  status: string;
  risk_level: string;
  risk_score: number;
  current_version: string;
  downloads: number;
  updated_at: string;
  author_name: string;
  rating_avg: number;
  rating_count: number;
  tags: string[];
  teams: { id: number; name: string }[];
  verified_at: string | null;
}

export interface PluginDetail extends PluginListItem {
  about: string;
  readme: string;
  faq: { q: string; a: string }[];
  permissions: string[];
  install_command: string;
  author_id: number;
  created_at: string;
  verified_by_name: string | null;
}

export interface VersionRow {
  id: number;
  plugin_id: number;
  version: string;
  changelog: string;
  file_path: string;
  created_by: number | null;
  created_at: string;
  author_name: string | null;
}

export interface SubmissionRow {
  id: number;
  plugin_id: number | null;
  submitted_by: number;
  submitter_name: string;
  kind: string;
  version: string;
  changelog: string;
  status: string;
  validation_report: string;
  security_report: string;
  risk_score: number;
  risk_level: string;
  manifest: string;
  file_path: string;
  reviewer_id: number | null;
  reviewer_name: string | null;
  review_notes: string;
  created_at: string;
  reviewed_at: string | null;
  plugin_name: string;
  plugin_slug: string;
  plugin_type: string;
}

export interface AuditRow {
  id: number;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  entity_name: string;
  details: string;
  created_at: string;
}

export interface TeamRow {
  id: number;
  name: string;
  description: string;
  member_count: number;
  member_names: string;
  plugin_count: number;
  is_member: number;
}

const LIST_COLS = `p.id, p.slug, p.name, p.type, p.summary, p.status, p.risk_level, p.risk_score,
         p.current_version, p.downloads, p.updated_at, p.verified_at,
         COALESCE(u.name, 'unknown') AS author_name`;
const LIST_SELECT = `SELECT ${LIST_COLS}
  FROM plugins p LEFT JOIN users u ON u.id = p.author_id`;

function attachTagsAndTeams(rows: Omit<PluginListItem, "tags" | "teams">[]): PluginListItem[] {
  if (rows.length === 0) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => "?").join(",");
  const tagRows = db
    .prepare(`SELECT plugin_id, tag FROM plugin_tags WHERE plugin_id IN (${ph})`)
    .all(...ids) as { plugin_id: number; tag: string }[];
  const teamRows = db
    .prepare(
      `SELECT tu.plugin_id, t.id, t.name FROM team_usage tu JOIN teams t ON t.id = tu.team_id WHERE tu.plugin_id IN (${ph})`
    )
    .all(...ids) as { plugin_id: number; id: number; name: string }[];
  const ratingRows = db
    .prepare(`SELECT plugin_id, AVG(rating) AS avg, COUNT(*) AS c FROM reviews WHERE plugin_id IN (${ph}) GROUP BY plugin_id`)
    .all(...ids) as unknown as { plugin_id: number; avg: number; c: number }[];
  return rows.map((r) => ({
    ...r,
    rating_avg: ratingRows.find((x) => x.plugin_id === r.id)?.avg ?? 0,
    rating_count: ratingRows.find((x) => x.plugin_id === r.id)?.c ?? 0,
    tags: tagRows.filter((t) => t.plugin_id === r.id).map((t) => t.tag),
    teams: teamRows.filter((t) => t.plugin_id === r.id).map((t) => ({ id: t.id, name: t.name })),
  }));
}

export function listPlugins(opts: {
  q?: string;
  type?: string;
  tag?: string;
  teamId?: number;
  status?: string;
  sort?: string;
  verified?: boolean;
}): PluginListItem[] {
  const where: string[] = ["p.status = ?"];
  const args: (string | number)[] = [opts.status ?? "approved"];
  if (opts.q) {
    where.push("(p.name LIKE ? OR p.summary LIKE ? OR p.slug LIKE ?)");
    const like = `%${opts.q}%`;
    args.push(like, like, like);
  }
  if (opts.type && opts.type !== "all") {
    where.push("p.type = ?");
    args.push(opts.type);
  }
  if (opts.tag) {
    where.push("p.id IN (SELECT plugin_id FROM plugin_tags WHERE tag = ?)");
    args.push(opts.tag);
  }
  if (opts.teamId) {
    where.push("p.id IN (SELECT plugin_id FROM team_usage WHERE team_id = ?)");
    args.push(opts.teamId);
  }
  if (opts.verified) where.push("p.verified_at IS NOT NULL");
  const order =
    opts.sort === "name" ? "p.name ASC" : opts.sort === "downloads" ? "p.downloads DESC" : "p.updated_at DESC";
  const rows = getDb()
    .prepare(`${LIST_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order}`)
    .all(...args) as unknown as Omit<PluginListItem, "tags" | "teams">[];
  return attachTagsAndTeams(rows);
}

export const getPluginBySlug = cache(function getPluginBySlug(slug: string): PluginDetail | null {
  const row = getDb()
    .prepare(`SELECT ${LIST_COLS}, p.about, p.readme, p.faq, p.permissions, p.install_command, p.author_id, p.created_at, vu.name AS verified_by_name
       FROM plugins p LEFT JOIN users u ON u.id = p.author_id LEFT JOIN users vu ON vu.id = p.verified_by WHERE p.slug = ?`)
    .get(slug) as unknown as (Omit<PluginListItem, "tags" | "teams"> & {
    about: string;
    readme: string;
    faq: string;
    permissions: string;
    install_command: string;
    author_id: number;
    created_at: string;
    verified_by_name: string | null;
  }) | undefined;
  if (!row) return null;
  const [withMeta] = attachTagsAndTeams([row]);
  let faq: { q: string; a: string }[] = [];
  let permissions: string[] = [];
  try {
    faq = JSON.parse(row.faq);
  } catch { /* ignore */ }
  try {
    permissions = JSON.parse(row.permissions);
  } catch { /* ignore */ }
  return { ...withMeta, about: row.about, readme: row.readme, faq, permissions, install_command: row.install_command, author_id: row.author_id, created_at: row.created_at, verified_by_name: row.verified_by_name };
});

export function getPluginVersions(pluginId: number): VersionRow[] {
  return getDb()
    .prepare(
      `SELECT v.*, u.name AS author_name FROM versions v LEFT JOIN users u ON u.id = v.created_by
       WHERE v.plugin_id = ? ORDER BY v.created_at DESC, v.id DESC`
    )
    .all(pluginId) as unknown as VersionRow[];
}

export function getPluginAudit(pluginId: number): AuditRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM audit_log WHERE (entity_type = 'plugin' AND entity_id = ?)
         OR (entity_type = 'submission' AND entity_id IN (SELECT id FROM submissions WHERE plugin_id = ?))
       ORDER BY created_at DESC, id DESC LIMIT 100`
    )
    .all(pluginId, pluginId) as unknown as AuditRow[];
}

export function listSubmissions(status?: string, userId?: number): SubmissionRow[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (status) {
    where.push("s.status = ?");
    args.push(status);
  }
  if (userId) {
    where.push("s.submitted_by = ?");
    args.push(userId);
  }
  const sql = `
    SELECT s.*, u.name AS submitter_name, r.name AS reviewer_name,
           COALESCE(p.name, 'deleted plugin') AS plugin_name, COALESCE(p.slug, '') AS plugin_slug, COALESCE(p.type, '') AS plugin_type
    FROM submissions s
    JOIN users u ON u.id = s.submitted_by
    LEFT JOIN users r ON r.id = s.reviewer_id
    LEFT JOIN plugins p ON p.id = s.plugin_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY s.created_at DESC`;
  return getDb().prepare(sql).all(...args) as unknown as SubmissionRow[];
}

export function getSubmission(id: number): SubmissionRow | null {
  const rows = listSubmissions();
  return rows.find((r) => r.id === id) ?? null;
}

export function allTags(): { tag: string; count: number }[] {
  return getDb()
    .prepare(
      `SELECT t.tag, COUNT(*) AS count FROM plugin_tags t
       JOIN plugins p ON p.id = t.plugin_id WHERE p.status = 'approved'
       GROUP BY t.tag ORDER BY count DESC, t.tag`
    )
    .all() as { tag: string; count: number }[];
}

export function listTeams(userId?: number): TeamRow[] {
  return getDb()
    .prepare(
      `SELECT t.id, t.name, t.description,
              (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count,
              COALESCE((SELECT GROUP_CONCAT(u.name, ', ') FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = t.id), '') AS member_names,
              (SELECT COUNT(*) FROM team_usage tu WHERE tu.team_id = t.id) AS plugin_count,
              COALESCE((SELECT 1 FROM team_members tm WHERE tm.team_id = t.id AND tm.user_id = ?), 0) AS is_member
       FROM teams t ORDER BY t.name`
    )
    .all(userId ?? -1) as unknown as TeamRow[];
}

export function myTeams(userId: number): { id: number; name: string }[] {
  return getDb()
    .prepare(`SELECT t.id, t.name FROM teams t JOIN team_members tm ON tm.team_id = t.id WHERE tm.user_id = ? ORDER BY t.name`)
    .all(userId) as { id: number; name: string }[];
}

export function teamPlugins(teamId: number): PluginListItem[] {
  const rows = getDb()
    .prepare(`${LIST_SELECT} WHERE p.status = 'approved' AND p.id IN (SELECT plugin_id FROM team_usage WHERE team_id = ?) ORDER BY p.name`)
    .all(teamId) as unknown as Omit<PluginListItem, "tags" | "teams">[];
  return attachTagsAndTeams(rows);
}

export function mySubmissions(userId: number): SubmissionRow[] {
  return listSubmissions(undefined, userId);
}

export function latestSubmissionForPlugin(pluginId: number): SubmissionRow | null {
  const rows = getDb()
    .prepare(
      `SELECT s.*, u.name AS submitter_name, r.name AS reviewer_name,
              p.name AS plugin_name, p.slug AS plugin_slug, p.type AS plugin_type
       FROM submissions s
       JOIN users u ON u.id = s.submitted_by
       LEFT JOIN users r ON r.id = s.reviewer_id
       JOIN plugins p ON p.id = s.plugin_id
       WHERE s.plugin_id = ? ORDER BY s.created_at DESC, s.id DESC LIMIT 1`
    )
    .all(pluginId) as unknown as SubmissionRow[];
  return rows[0] ?? null;
}

export function pendingSubmissionsForPlugin(pluginId: number): SubmissionRow[] {
  const rows = getDb()
    .prepare(
      `SELECT s.*, u.name AS submitter_name, r.name AS reviewer_name,
              p.name AS plugin_name, p.slug AS plugin_slug, p.type AS plugin_type
       FROM submissions s
       JOIN users u ON u.id = s.submitted_by
       LEFT JOIN users r ON r.id = s.reviewer_id
       JOIN plugins p ON p.id = s.plugin_id
       WHERE s.plugin_id = ? AND s.status = 'pending' ORDER BY s.created_at DESC`
    )
    .all(pluginId) as unknown as SubmissionRow[];
  return rows;
}

export function recentAudit(limit = 200): AuditRow[] {
  return getDb()
    .prepare(`SELECT * FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(limit) as unknown as AuditRow[];
}

export interface ActivityItem extends AuditRow {
  actor_id: number | null;
  plugin_slug: string | null;
  playbook_slug: string | null;
  plugin_status: string | null;
}

/**
 * Audit rows joined to their plugin / playbook slugs for the activity feed.
 * actor_name is resolved to the user's current display name; plugin_status is
 * the plugin's CURRENT status so the feed can filter to approved items only.
 */
export function recentActivity(limit = 80): ActivityItem[] {
  return getDb()
    .prepare(
      `SELECT a.*,
              COALESCE(u.name, a.actor_name) AS actor_name,
              COALESCE(p.slug, sp.slug) AS plugin_slug,
              pb.slug AS playbook_slug,
              COALESCE(p.status, sp.status) AS plugin_status
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       LEFT JOIN plugins p ON a.entity_type = 'plugin' AND p.id = a.entity_id
       LEFT JOIN submissions s ON a.entity_type = 'submission' AND s.id = a.entity_id
       LEFT JOIN plugins sp ON sp.id = s.plugin_id
       LEFT JOIN playbooks pb ON a.entity_type = 'playbook' AND pb.id = a.entity_id
       ORDER BY a.created_at DESC, a.id DESC LIMIT ?`
    )
    .all(limit) as unknown as ActivityItem[];
}

export function adminStats() {
  const db = getDb();
  const one = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
  return {
    pending: one(`SELECT COUNT(*) c FROM submissions WHERE status = 'pending'`),
    approved: one(`SELECT COUNT(*) c FROM plugins WHERE status = 'approved'`),
    rejected: one(`SELECT COUNT(*) c FROM submissions WHERE status = 'rejected'`),
    users: one(`SELECT COUNT(*) c FROM users`),
    teams: one(`SELECT COUNT(*) c FROM teams`),
    downloads: one(`SELECT COALESCE(SUM(downloads),0) c FROM plugins`),
  };
}

// ---------------- playbooks ----------------

export interface PlaybookListItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  author_name: string;
  author_id: number;
  item_count: number;
  types: string[];
  created_at: string;
  updated_at: string;
}

export interface PlaybookDetail extends PlaybookListItem {
  items: PluginListItem[];
}

export function listPlaybooks(opts?: { q?: string }): PlaybookListItem[] {
  const where: string[] = ["1=1"];
  const args: string[] = [];
  if (opts?.q) {
    where.push("(pb.name LIKE ? OR pb.description LIKE ?)");
    args.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  const rows = getDb()
    .prepare(
      `SELECT pb.id, pb.slug, pb.name, pb.description, pb.author_id, pb.created_at, pb.updated_at,
              COALESCE(u.name, 'unknown') AS author_name,
              (SELECT COUNT(*) FROM playbook_items pi JOIN plugins p ON p.id = pi.plugin_id AND p.status = 'approved' WHERE pi.playbook_id = pb.id) AS item_count,
              COALESCE((SELECT GROUP_CONCAT(DISTINCT p.type) FROM playbook_items pi
                        JOIN plugins p ON p.id = pi.plugin_id AND p.status = 'approved' WHERE pi.playbook_id = pb.id), '') AS types
       FROM playbooks pb LEFT JOIN users u ON u.id = pb.author_id
       WHERE ${where.join(" AND ")} ORDER BY pb.updated_at DESC`
    )
    .all(...args) as unknown as (Omit<PlaybookListItem, "types"> & { types: string })[];
  return rows.map((r) => ({ ...r, types: r.types ? r.types.split(",") : [] }));
}

export function getPlaybookBySlug(slug: string): PlaybookDetail | null {
  const pb = getDb()
    .prepare(
      `SELECT pb.id, pb.slug, pb.name, pb.description, pb.author_id, pb.created_at, pb.updated_at,
              COALESCE(u.name, 'unknown') AS author_name,
              (SELECT COUNT(*) FROM playbook_items pi JOIN plugins p ON p.id = pi.plugin_id AND p.status = 'approved' WHERE pi.playbook_id = pb.id) AS item_count,
              COALESCE((SELECT GROUP_CONCAT(DISTINCT p.type) FROM playbook_items pi
                        JOIN plugins p ON p.id = pi.plugin_id AND p.status = 'approved' WHERE pi.playbook_id = pb.id), '') AS types
       FROM playbooks pb LEFT JOIN users u ON u.id = pb.author_id WHERE pb.slug = ?`
    )
    .get(slug) as unknown as (Omit<PlaybookListItem, "types"> & { types: string }) | undefined;
  if (!pb) return null;
  const itemRows = getDb()
    .prepare(
      `${LIST_SELECT} JOIN playbook_items pi ON pi.plugin_id = p.id
       WHERE pi.playbook_id = ? AND p.status = 'approved' ORDER BY pi.position, pi.rowid`
    )
    .all(pb.id) as unknown as Omit<PluginListItem, "tags" | "teams">[];
  return { ...pb, types: pb.types ? pb.types.split(",") : [], items: attachTagsAndTeams(itemRows) };
}

export function myPlaybooks(userId: number): { id: number; name: string; slug: string }[] {
  return getDb()
    .prepare(`SELECT id, name, slug FROM playbooks WHERE author_id = ? ORDER BY name`)
    .all(userId) as unknown as { id: number; name: string; slug: string }[];
}

export function playbooksContainingPlugin(pluginId: number): { id: number; slug: string; name: string; author_id: number }[] {
  return getDb()
    .prepare(
      `SELECT pb.id, pb.slug, pb.name, pb.author_id FROM playbooks pb
       JOIN playbook_items pi ON pi.playbook_id = pb.id WHERE pi.plugin_id = ? ORDER BY pb.name`
    )
    .all(pluginId) as unknown as { id: number; slug: string; name: string; author_id: number }[];
}

export interface ReviewRow {
  id: number;
  plugin_id: number;
  user_id: number;
  user_name: string;
  rating: number;
  body: string;
  created_at: string;
  updated_at: string;
}

export function reviewsForPlugin(pluginId: number): ReviewRow[] {
  return getDb()
    .prepare(
      `SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.plugin_id = ? ORDER BY r.created_at DESC`
    )
    .all(pluginId) as unknown as ReviewRow[];
}

export function myReview(pluginId: number, userId: number): ReviewRow | null {
  const r = getDb()
    .prepare(
      `SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.plugin_id = ? AND r.user_id = ?`
    )
    .get(pluginId, userId) as unknown as ReviewRow | undefined;
  return r ?? null;
}
