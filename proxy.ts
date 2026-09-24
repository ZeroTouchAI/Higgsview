import { NextResponse, type NextRequest } from "next/server";
import { activeHash } from "@/lib/auth";

// Password gate (see lib/auth.ts). With no password configured (local dev), everything is open.
export async function proxy(req: NextRequest) {
  const want = await activeHash();
  if (!want || req.cookies.get("hv_auth")?.value === want) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!login|api/login|_next|favicon.ico).*)"] };
