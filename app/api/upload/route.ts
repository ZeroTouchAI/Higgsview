import { kie } from "@/lib/kie";

// Browser → here → Kie temp storage. Returns a public URL models can read.
// ponytail: Vercel caps request bodies at ~4.5MB; for bigger videos upload straight to Kie or Blob storage.
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "file required" }, { status: 400 });
  const out = new FormData();
  out.set("file", file);
  out.set("uploadPath", "higgsview");
  out.set("fileName", `${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`);
  try {
    const d = await kie("https://kieai.redpandaai.co/api/file-stream-upload", { method: "POST", body: out });
    return Response.json({ url: d.downloadUrl });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
