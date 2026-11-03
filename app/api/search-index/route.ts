import { NextResponse } from "next/server";
import { listPlaybooks, listPlugins } from "@/lib/queries";

export function GET() {
  const plugins = listPlugins({ status: "approved" }).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    type: p.type,
    summary: p.summary,
    tags: p.tags,
    risk_level: p.risk_level,
    rating_avg: p.rating_avg,
    verified: !!p.verified_at,
  }));
  const playbooks = listPlaybooks().map((pb) => ({
    slug: pb.slug,
    name: pb.name,
    description: pb.description,
  }));
  return NextResponse.json({ plugins, playbooks });
}
