import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const pb = db.prepare(`SELECT slug, name FROM playbooks WHERE slug = ?`).get(slug) as { slug: string; name: string } | undefined;
  if (!pb) return NextResponse.json({ error: "Playbook not found." }, { status: 404 });
  const items = db
    .prepare(
      `SELECT p.slug, p.name, p.type, p.current_version AS version FROM playbook_items pi
       JOIN plugins p ON p.id = pi.plugin_id
       WHERE pi.playbook_id = (SELECT id FROM playbooks WHERE slug = ?) AND p.status = 'approved'
       ORDER BY pi.position, p.name`
    )
    .all(slug) as { slug: string; name: string; type: string; version: string }[];
  return NextResponse.json({ slug: pb.slug, name: pb.name, items });
}
