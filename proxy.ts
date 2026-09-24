import { NextResponse, type NextRequest } from "next/server";

// Single-user password gate. If APP_PASSWORD is unset (local dev), everything is open.
export async function hash(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("higgsview:" + s));
  return Buffer.from(buf).toString("hex");
}

export async function proxy(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw || req.cookies.get("hv_auth")?.value === (await hash(pw))) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!login|api/login|_next|favicon.ico).*)"] };
