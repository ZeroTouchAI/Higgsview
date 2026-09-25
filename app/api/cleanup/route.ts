import { del, list } from "@vercel/blob";

// Daily Vercel cron (vercel.json): deletes uploaded inputs older than 7 days to keep Blob storage (and cost) small.
// Joined videos are results, not inputs: they stay.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const cutoff = Date.now() - 7 * 864e5;
  let cursor: string | undefined, removed = 0;
  do {
    const page = await list({ prefix: "uploads/", limit: 1000, cursor });
    const old = page.blobs.filter((b) => +b.uploadedAt < cutoff && !b.pathname.includes("joined-")).map((b) => b.url);
    if (old.length) await del(old);
    removed += old.length;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return Response.json({ removed });
}
