// Export a result to Google Drive via the Make.com scenario "Higgsview - Export to Google Drive"
// (webhook → download file → upload to My Drive/Higgsview → respond {link, id}).
export async function POST(req: Request) {
  const hook = process.env.MAKE_EXPORT_WEBHOOK;
  if (!hook) return Response.json({ error: "MAKE_EXPORT_WEBHOOK is not set" }, { status: 500 });
  const { url, name } = await req.json();
  if (!/^https:\/\//.test(url ?? "")) return Response.json({ error: "Invalid url" }, { status: 400 });
  const res = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, name }) });
  const text = await res.text();
  try {
    const { link } = JSON.parse(text);
    if (link) return Response.json({ link });
  } catch {}
  return Response.json({ error: `Drive export failed: ${text.slice(0, 200)}` }, { status: 502 });
}
