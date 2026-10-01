// Fallback for browsers that can't download from Kie's file host directly (extensions, antivirus or network
// filters blocking it): returns one piece of a Kie result file. Vercel caps a response at 4.5 MB, so the browser
// asks for 4 MB pieces (?from=&to=) and stitches them together (lib/kieFile.ts). Sign-in is checked by proxy.ts.
const KIE_FILES = /^https:\/\/[a-z0-9.-]*\.(aiquickdraw\.com|kie\.ai|redpandaai\.co)\//; // only Kie's hosts: never an open proxy

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const u = q.get("u") ?? "", from = Number(q.get("from") ?? 0), to = Number(q.get("to") ?? from + 4_000_000 - 1);
  if (!KIE_FILES.test(u) || !(from >= 0) || !(to >= from) || to - from >= 4_200_000) return new Response("Bad request", { status: 400 });
  const r = await fetch(u, { headers: { Range: `bytes=${from}-${to}` }, cache: "no-store" });
  if (!r.ok) return new Response("Not available", { status: r.status === 416 ? 416 : 404 });
  const total = r.headers.get("content-range")?.split("/")[1] ?? r.headers.get("content-length") ?? "";
  return new Response(r.body, { headers: { "Content-Type": r.headers.get("content-type") ?? "application/octet-stream", "X-Total": total, "Cache-Control": "no-store" } });
}
