import { presignGet } from "@/lib/blobUrl";

// Permanent link to a private Blob file (joined videos etc.) for the logged-in browser: redirects to a fresh
// signed Blob URL, which supports Range requests (seeking, correct video length) and CORS (Join, Download).
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams.get("p") ?? "";
  if (!/^(uploads|joined)\/[\w.-]+$/.test(p)) return new Response("Not found", { status: 404 });
  return Response.redirect(await presignGet(p, 12), 302);
}
