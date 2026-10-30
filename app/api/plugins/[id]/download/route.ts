import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized — please log in.", { status: 401 });

  const db = getDb();
  const plugin = db.prepare(`SELECT * FROM plugins WHERE id = ?`).get(Number(id)) as
    | { id: number; slug: string; name: string; status: string; author_id: number; current_version: string }
    | undefined;
  if (!plugin) return new Response("Not found", { status: 404 });
  if (plugin.status !== "approved" && !user.is_admin && user.id !== plugin.author_id) {
    return new Response("Forbidden", { status: 403 });
  }

  const want = new URL(req.url).searchParams.get("v");
  const version = want
    ? (db.prepare(`SELECT * FROM versions WHERE plugin_id = ? AND version = ?`).get(plugin.id, want) as
        | { version: string; file_path: string }
        | undefined)
    : (db.prepare(`SELECT * FROM versions WHERE plugin_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`).get(plugin.id) as
        | { version: string; file_path: string }
        | undefined);

  if (!version?.file_path || !fs.existsSync(version.file_path)) {
    return new Response("No downloadable archive for this version.", { status: 404 });
  }

  db.prepare(`UPDATE plugins SET downloads = downloads + 1 WHERE id = ?`).run(plugin.id);
  audit(user, "downloaded", "plugin", plugin.id, plugin.name, { version: version.version });

  const data = fs.readFileSync(version.file_path);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${plugin.slug}-${version.version}.zip"`,
      "Content-Length": String(data.length),
    },
  });
}
