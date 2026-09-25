import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth";

// Sign-in gate (Google, see lib/auth.ts). /api/cleanup checks its own CRON_SECRET.
export async function proxy(req: NextRequest) {
  // Production answers on several Vercel names (deployment URLs, git-main alias); Google sign-in only allows the
  // registered one, so send everything to it. Preview deployments keep their own URL.
  const home = "higgsview.vercel.app";
  if (process.env.VERCEL_ENV === "production" && req.nextUrl.hostname !== home && req.nextUrl.hostname.endsWith(".vercel.app")) {
    const url = req.nextUrl.clone();
    url.hostname = home; url.port = ""; url.protocol = "https";
    return NextResponse.redirect(url, 308);
  }
  if (/^\/(login|api\/login)$/.test(req.nextUrl.pathname) || verifySession(req.cookies.get("hv_session")?.value)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return Response.json({ error: "Please sign in again" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!api/cleanup|_next|favicon.ico|thumbs).*)"] };
