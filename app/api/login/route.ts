import { hash } from "@/proxy";

export async function POST(req: Request) {
  const { password } = await req.json();
  const pw = process.env.APP_PASSWORD;
  if (!pw || password !== pw) return Response.json({ error: "Wrong password" }, { status: 401 });
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", `hv_auth=${await hash(pw)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 90}`);
  return res;
}
