import { issueSignedToken, presignUrl } from "@vercel/blob";

// Returns presigned URLs: the browser PUTs the file straight to our private Blob store (no Vercel body-size cap),
// and the GET URL (valid 24h) is what we hand to Kie as the input image/video.
export async function POST(req: Request) {
  const { name, type, size } = await req.json();
  // What the browser sends after conversion (other image types are turned into JPG first).
  if (!/^(image\/(jpeg|png)|video\/(mp4|quicktime|webm)|audio\/(mpeg|mp3|wav|x-wav|wave|mp4|x-m4a|m4a|aac))$/.test(type ?? ""))
    return Response.json({ error: "Unsupported file type. Use JPG/PNG, MP4/MOV/WebM or MP3/WAV/M4A." }, { status: 400 });
  if (size > 500 * 1024 * 1024) return Response.json({ error: "Max 500 MB" }, { status: 400 });
  const pathname = `uploads/${Date.now()}-${String(name).replace(/[^\w.-]/g, "_")}`;
  const validUntil = Date.now() + 24 * 60 * 60 * 1000;
  try {
    const token = await issueSignedToken({ pathname, operations: ["put", "get"], validUntil });
    const [{ presignedUrl: putUrl }, { presignedUrl: getUrl }] = await Promise.all([
      presignUrl(token, { access: "private", operation: "put", pathname, validUntil, allowedContentTypes: [type], addRandomSuffix: false }),
      presignUrl(token, { access: "private", operation: "get", pathname, validUntil }),
    ]);
    return Response.json({ putUrl, getUrl });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
