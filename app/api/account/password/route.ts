import { activeHash, authCookie, hash, setPassword } from "@/lib/auth";

// Change the login password: needs the current one; returns a fresh login cookie for this browser.
export async function POST(req: Request) {
  const { current, next } = await req.json();
  const want = await activeHash();
  if (want && (await hash(String(current ?? ""))) !== want) return Response.json({ error: "Current password is wrong" }, { status: 401 });
  if (String(next ?? "").length < 8) return Response.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  const h = await setPassword(String(next));
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", authCookie(h));
  return res;
}
