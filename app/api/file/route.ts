import { get } from "@vercel/blob";

// Streams a private Blob file (joined videos etc.) to the logged-in browser: a permanent link that doesn't expire.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams.get("p") ?? "";
  if (!/^(uploads|joined)\//.test(p)) return new Response("Not found", { status: 404 });
  const r = await get(p, { access: "private" });
  if (!r || r.statusCode !== 200) return new Response("Not found", { status: 404 });
  return new Response(r.stream, { headers: { "Content-Type": r.blob.contentType, "Content-Length": String(r.blob.size), "Cache-Control": "private, max-age=86400" } });
}
