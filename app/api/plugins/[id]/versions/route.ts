import { NextRequest, NextResponse } from "next/server";
import { guardUpload } from "@/lib/upload-guard";
import { submitVersion } from "@/lib/submissions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guarded = await guardUpload(req);
  if (guarded instanceof NextResponse) return guarded;
  const { user } = guarded;

  const { id } = await params;
  const formData = await req.formData();
  const res = await submitVersion(user, Number(id), formData);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status ?? 400 });
  return NextResponse.json({ slug: res.slug }, { status: 200 });
}
