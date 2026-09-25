import { sessionCookie } from "@/lib/auth";

// Clears the sign-in cookie (see proxy.ts). The client then goes to /login.
export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", sessionCookie("", 0));
  return res;
}
