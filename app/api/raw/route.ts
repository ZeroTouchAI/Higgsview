import { kie } from "@/lib/kie";

// Debug: raw Kie task record (login-protected like every API route). /api/raw?id=<taskId>
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  try {
    return Response.json(await kie(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(id)}`));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
