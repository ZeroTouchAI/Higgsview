import { activeHash, authCookie, hash } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json();
  const want = await activeHash();
  if (!want || (await hash(String(password ?? ""))) !== want) return Response.json({ error: "Wrong password" }, { status: 401 });
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", authCookie(want));
  return res;
}
