import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, canViewPlugin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { readZip, ZipError } from "@/lib/zipstore";
import { LIMITS } from "@/lib/scan";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getRequestUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized — log in or pass a Bearer token (create one at /profile#tokens)." },
      { status: 401 }
    );
  }
  const { slug } = await params;
  const db = getDb();
  const plugin = db.prepare(`SELECT id, slug, name, type, status, author_id, current_version FROM plugins WHERE slug = ?`).get(slug) as
    | { id: number; slug: string; name: string; type: string; status: string; author_id: number; current_version: string }
    | undefined;
  if (!plugin || !canViewPlugin(plugin, user)) {
    return NextResponse.json({ error: "Plugin not found." }, { status: 404 });
  }
  const want = new URL(req.url).searchParams.get("v");
  const version = want
    ? (db.prepare(`SELECT version, file_path, manifest FROM versions WHERE plugin_id = ? AND version = ?`).get(plugin.id, want) as
        | { version: string; file_path: string; manifest: string }
        | undefined)
    : (db.prepare(`SELECT version, file_path, manifest FROM versions WHERE plugin_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`).get(plugin.id) as
        | { version: string; file_path: string; manifest: string }
        | undefined);
  if (!version?.file_path || !fs.existsSync(version.file_path)) {
    return NextResponse.json({ error: "No files for this version." }, { status: 404 });
  }
  let files: { path: string; base64: string }[];
  try {
    const entries = readZip(fs.readFileSync(version.file_path), {
      maxEntries: LIMITS.maxFiles,
      maxTotalBytes: LIMITS.maxUncompressedBytes,
    });
    files = entries.map((e) => ({ path: e.name, base64: Buffer.from(e.data).toString("base64") }));
  } catch (e) {
    const msg = e instanceof ZipError ? e.message : "Could not read the stored archive.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  let server: unknown = null;
  try {
    server = (JSON.parse(version.manifest || "{}") as { server?: unknown }).server ?? null;
  } catch { server = null; }
  db.prepare(`UPDATE plugins SET downloads = downloads + 1 WHERE id = ?`).run(plugin.id);
  audit(user, "downloaded", "plugin", plugin.id, plugin.name, { version: version.version, via: "cli" });
  return NextResponse.json({ slug: plugin.slug, name: plugin.name, type: plugin.type, version: version.version, server, files });
}
