import { mutate } from "@/lib/store";

// Google Drive export runs in the browser with the user's own Google login (components/Feed.tsx → DriveButton);
// this only remembers the resulting Drive link on the History item.
export async function POST(req: Request) {
  const { id, link, folder, folderName } = await req.json();
  const drive = (u: unknown) => /^https:\/\/drive\.google\.com\//.test(String(u));
  if (!drive(link) || !drive(folder)) return Response.json({ error: "Bad link" }, { status: 400 });
  const driveFolder = { link: folder, name: String(folderName ?? "Google Drive").slice(0, 120) };
  await mutate((all) => all.map((i) => (i.id === id ? { ...i, driveLink: link, driveFolder } : i)));
  return Response.json({ link });
}
