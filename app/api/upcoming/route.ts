import { getUpcoming, setStatus, type Status } from "@/lib/upcoming";

// GET: tracker (re-scans Higgsfield if the last check is over a day old; ?force=1 to scan now).
export async function GET(req: Request) {
  return Response.json(await getUpcoming(new URL(req.url).searchParams.has("force")));
}

// POST { path, status }: mark an item built / ignored / todo.
export async function POST(req: Request) {
  const { path, status } = (await req.json()) as { path: string; status: Status };
  if (!["new", "todo", "built", "ignored"].includes(status)) return Response.json({ error: "bad status" }, { status: 400 });
  return Response.json(await setStatus(path, status));
}
