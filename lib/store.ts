// Server-side history: one JSON file in a private Vercel Blob store (free tier), shared by every device.
import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import type { Item } from "@/lib/history";

const PATH = "history.json";

export async function readHistory(): Promise<{ items: Item[]; etag?: string }> {
  const r = await get(PATH, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return { items: [] };
  // get() returns a weak ETag (W/"…"); conditional put() needs the strong form.
  return { items: JSON.parse(await new Response(r.stream).text()), etag: r.blob.etag.replace(/^W\//, "") };
}

// Read-modify-write with an ETag check so concurrent requests can't drop each other's changes.
export async function mutate(fn: (items: Item[]) => Item[]) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { items, etag } = await readHistory();
    const next = fn(items);
    try {
      await put(PATH, JSON.stringify(next), {
        access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
        ...(etag ? { ifMatch: etag } : {}),
      });
      return next;
    } catch (e) {
      if (!(e instanceof BlobPreconditionFailedError)) throw e;
    }
  }
  throw new Error("History is busy, try again");
}
