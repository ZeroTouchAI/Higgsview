import { mutate } from "@/lib/store";

// Google Drive export runs in the browser with the user's own Google login (components/Feed.tsx → DriveButton);
// this only remembers the resulting Drive link on the History item.
export async function POST(req: Request) {
  const { id, link } = await req.json();
  if (!/^https:\/\/drive\.google\.com\//.test(String(link))) return Response.json({ error: "Bad link" }, { status: 400 });
  await mutate((all) => all.map((i) => (i.id === id ? { ...i, driveLink: link } : i)));
  return Response.json({ link });
}
