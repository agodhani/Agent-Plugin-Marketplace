import fs from "node:fs";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const db = getDb();
  const sub = db.prepare(`SELECT * FROM submissions WHERE id = ?`).get(Number(id)) as
    | { id: number; submitted_by: number; file_path: string; plugin_id: number; version: string }
    | undefined;
  if (!sub) return new Response("Not found", { status: 404 });
  const plugin = db.prepare(`SELECT slug, author_id FROM plugins WHERE id = ?`).get(sub.plugin_id) as
    | { slug: string; author_id: number }
    | undefined;
  if (!user.is_admin && user.id !== sub.submitted_by && user.id !== plugin?.author_id) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!sub.file_path || !fs.existsSync(sub.file_path)) {
    return new Response("No archive attached to this submission.", { status: 404 });
  }
  const data = fs.readFileSync(sub.file_path);
  const name = `${plugin?.slug ?? "submission"}-${sub.version}-submission.zip`;
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(data.length),
    },
  });
}
