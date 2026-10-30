import { NextResponse, type NextRequest } from "next/server";

// In development the app is often reached through a preview/reverse proxy whose
// public origin differs from the upstream host Next sees via x-forwarded-host.
// Next's server-action CSRF check rejects that mismatch, so every form action
// (login, submit, review, ...) 500s through the proxy. Normalize
// x-forwarded-host to the request origin for action calls, dev only.
export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === "development" && req.method === "POST" && req.headers.has("next-action")) {
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        const headers = new Headers(req.headers);
        headers.set("x-forwarded-host", new URL(origin).host);
        return NextResponse.next({ request: { headers } });
      } catch {
        // malformed origin — let the normal flow handle it
      }
    }
  }
  return NextResponse.next();
}
