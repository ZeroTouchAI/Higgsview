import { byId, type Params } from "@/lib/models";
import { kie } from "@/lib/kie";

export async function POST(req: Request) {
  const { modelId, params } = (await req.json()) as { modelId: string; params: Params };
  const m = byId(modelId);
  if (!m) return Response.json({ error: "Unknown model" }, { status: 400 });
  if (!params.prompt?.trim() && m.mode !== "motion") return Response.json({ error: "Prompt is required" }, { status: 400 });
  for (const need of m.needs ?? [])
    if (!params[need]) return Response.json({ error: `${m.name} needs ${need === "video" ? "an input video" : "a start image"}` }, { status: 400 });

  const body = m.build(params);
  if ("url" in body) return Response.json({ url: body.url }); // free/direct providers
  try {
    const data = await kie("/api/v1/jobs/createTask", { method: "POST", body: JSON.stringify(body) });
    return Response.json({ taskId: data.taskId });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
