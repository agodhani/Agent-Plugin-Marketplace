import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "./auth";
import { LIMITS } from "./scan";

/**
 * Shared upload guard, in order: session → origin check (prod only) →
 * content-length required → content-length within the upload budget.
 * Returns the user, or a NextResponse error to send back.
 */
export async function guardUpload(req: NextRequest): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to submit." }, { status: 401 });

  if (process.env.NODE_ENV === "production") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = origin ? new URL(origin).host : null;
    } catch {
      originHost = null;
    }
    if (!origin || originHost !== host) {
      return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
    }
  }

  const len = req.headers.get("content-length");
  if (len === null) return NextResponse.json({ error: "Content-Length required." }, { status: 411 });
  if (Number(len) > LIMITS.maxUploadBytes + 1024 * 1024) {
    return NextResponse.json({ error: "Archive exceeds the 50 MB limit." }, { status: 413 });
  }
  return { user };
}
