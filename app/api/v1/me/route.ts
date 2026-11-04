import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized — log in or pass a Bearer token (create one at /profile#tokens)." }, { status: 401 });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
