import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth";

// Sign-in gate (Google, see lib/auth.ts). /api/cleanup checks its own CRON_SECRET.
export async function proxy(req: NextRequest) {
  if (verifySession(req.cookies.get("hv_session")?.value)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return Response.json({ error: "Please sign in again" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!login|api/login|api/cleanup|_next|favicon.ico|thumbs).*)"] };
