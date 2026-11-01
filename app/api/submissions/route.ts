import { NextRequest, NextResponse } from "next/server";
import { guardUpload } from "@/lib/upload-guard";
import { submitPlugin } from "@/lib/submissions";

export async function POST(req: NextRequest) {
  const guarded = await guardUpload(req);
  if (guarded instanceof NextResponse) return guarded;
  const { user } = guarded;

  const formData = await req.formData();
  const res = await submitPlugin(user, formData);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status ?? 400 });
  return NextResponse.json({ slug: res.slug }, { status: 200 });
}
