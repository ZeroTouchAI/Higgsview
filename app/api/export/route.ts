import { mutate, readHistory } from "@/lib/store";
import { internalPath, presignGet } from "@/lib/blobUrl";

// Export a result to Google Drive via the Make.com scenario "Higgsview - Export to Google Drive"
// (webhook → download file → upload to My Drive/Higgsview → respond {link, id}).
export async function POST(req: Request) {
  const hook = process.env.MAKE_EXPORT_WEBHOOK;
  if (!hook) return Response.json({ error: "MAKE_EXPORT_WEBHOOK is not set" }, { status: 500 });
  const { id } = await req.json();
  const item = (await readHistory()).items.find((i) => i.id === id);
  if (!item?.url) return Response.json({ error: "Nothing to export" }, { status: 404 });

  const ext = (internalPath(item.url) ?? item.url).match(/\.(mp4|mov|webm|png|jpe?g|webp)(\?|$)/i)?.[1] ?? (item.kind === "video" ? "mp4" : "jpg");
  const name = `higgsview-${item.modelId}-${new Date(item.createdAt).toISOString().slice(0, 19).replace(/:/g, "-")}.${ext}`;
  // Joined videos live in our private store: hand Make a temporary public link.
  const path = internalPath(item.url);
  const url = path ? await presignGet(path) : item.url;
  const res = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, name }) });
  const text = await res.text();
  let link: string | undefined;
  try { link = JSON.parse(text).link; } catch {}
  if (!link) return Response.json({ error: `Drive export failed: ${text.slice(0, 200)}` }, { status: 502 });
  await mutate((all) => all.map((i) => (i.id === id ? { ...i, driveLink: link } : i)));
  return Response.json({ link });
}
