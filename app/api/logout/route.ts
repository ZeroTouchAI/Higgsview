// Clears the login cookie (see proxy.ts). The client then goes to /login.
export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", "hv_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return res;
}
