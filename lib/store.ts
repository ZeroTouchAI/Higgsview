// Server-side JSON storage in the private Vercel Blob store (free tier), shared by every device.
// users/<sub>/history.json = one user's generations; upcoming.json = Higgsfield feature tracker (shared).
import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import type { Item } from "@/lib/history";
import { userDir } from "@/lib/auth";

export async function readJson<T>(path: string, empty: T): Promise<{ data: T; etag?: string }> {
  const r = await get(path, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return { data: empty };
  // get() returns a weak ETag (W/"…"); conditional put() needs the strong form.
  return { data: JSON.parse(await new Response(r.stream).text()), etag: r.blob.etag.replace(/^W\//, "") };
}

// Read-modify-write with an ETag check so concurrent requests can't drop each other's changes.
export async function mutateJson<T>(path: string, empty: T, fn: (data: T) => T) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, etag } = await readJson(path, empty);
    const next = fn(data);
    try {
      await put(path, JSON.stringify(next), {
        access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
        ...(etag ? { ifMatch: etag } : {}),
      });
      return next;
    } catch (e) {
      if (!(e instanceof BlobPreconditionFailedError)) throw e;
    }
  }
  throw new Error(`${path} is busy, try again`);
}

// The signed-in user's history.
export const readHistory = async () => {
  const { data, etag } = await readJson<Item[]>(`${await userDir()}history.json`, []);
  return { items: data, etag };
};
export const mutate = async (fn: (items: Item[]) => Item[]) => mutateJson<Item[]>(`${await userDir()}history.json`, [], fn);
