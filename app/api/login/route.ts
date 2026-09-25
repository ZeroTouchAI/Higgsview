import { get, put } from "@vercel/blob";
import { isOwner, sessionCookie, signSession, type User } from "@/lib/auth";

// Google Sign-In: the browser sends Google's ID token; Google's tokeninfo endpoint checks the signature and expiry.
export async function POST(req: Request) {
  const { credential } = await req.json();
  const t = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(credential ?? ""))}`).then((r) => r.json()).catch(() => ({}));
  if (!t.sub || t.aud !== process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || String(t.email_verified) !== "true")
    return Response.json({ error: "Google sign-in failed, try again" }, { status: 401 });
  const user: User = { sub: t.sub, email: t.email, name: t.name, picture: t.picture };
  if (isOwner(user)) await adoptOwnerData(user.sub);
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", sessionCookie(signSession(user)));
  return res;
}

// One-time move: the single-user version kept history/profile at the store root; the owner's first sign-in copies them over.
async function adoptOwnerData(sub: string) {
  for (const f of ["history.json", "profile.json"]) {
    const dest = `users/${sub}/${f}`;
    if ((await get(dest, { access: "private" }).catch(() => null))?.statusCode === 200) continue;
    const src = await get(f, { access: "private" }).catch(() => null);
    if (src?.statusCode === 200) await put(dest, await new Response(src.stream).text(), { access: "private", contentType: "application/json", addRandomSuffix: false });
  }
}
