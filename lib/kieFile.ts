// Gets a Kie result file as a Blob in the browser. Normally straight from Kie (its file host allows it); if the
// browser can't (some extensions, antivirus or networks block those downloads: "Failed to fetch"), the file is
// pulled through our server in 4 MB pieces (/api/fetch) and stitched together.
const PIECE = 4_000_000;

export async function kieBlob(url: string): Promise<Blob> {
  if (!/^https:\/\//.test(url)) return fetch(url).then((r) => { if (!r.ok) throw new Error("Couldn't load the file"); return r.blob(); }); // blob: / same-origin
  try {
    // cache: "no-store": the History cards loaded this file without CORS, and Chrome would reuse that copy and fail.
    const r = await fetch(url, { cache: "no-store" });
    if ([403, 404, 410].includes(r.status)) throw new Gone();
    if (r.ok) return await r.blob();
  } catch (e) {
    if (e instanceof Gone) throw new Error("The file is no longer available at Kie.ai.");
  }
  const parts: Blob[] = [];
  let type = "", total = Infinity;
  for (let from = 0; from < total; from += PIECE) {
    const r = await piece(url, from);
    type = r.headers.get("content-type") ?? type;
    total = Number(r.headers.get("x-total")) || 0;
    parts.push(await r.blob());
  }
  return new Blob(parts, { type });
}

class Gone extends Error {}

async function piece(url: string, from: number) {
  for (let n = 0; ; n++) {
    const r = await fetch(`/api/fetch?u=${encodeURIComponent(url)}&from=${from}&to=${from + PIECE - 1}`).catch(() => undefined);
    if (r?.ok) return r;
    if (r?.status === 404) throw new Error("The file is no longer available at Kie.ai.");
    if (n === 2) throw new Error("Couldn't download the file (tried directly and through Higgsview). Check your connection and try again.");
    await new Promise((s) => setTimeout(s, 1500 * (n + 1)));
  }
}
