import { byId, type Params } from "@/lib/models";
import { kie } from "@/lib/kie";
import { mutate } from "@/lib/store";

export async function POST(req: Request) {
  const { modelId, params } = (await req.json()) as { modelId: string; params: Params };
  const m = byId(modelId);
  if (!m) return Response.json({ error: "Unknown model" }, { status: 400 });
  if (!params.prompt?.trim() && !m.promptOptional) return Response.json({ error: "Prompt is required" }, { status: 400 });
  for (const need of m.needs ?? [])
    if (!params[need]) return Response.json({ error: `${m.name} needs ${m.labels?.[need] ?? need}` }, { status: 400 });

  const body = m.build(params);
  let taskId: string | undefined;
  if (!("url" in body)) {
    try {
      taskId = (await kie("/api/v1/jobs/createTask", { method: "POST", body: JSON.stringify(body) })).taskId;
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 502 });
    }
  }
  const url = "url" in body ? body.url : undefined; // free/direct providers are done immediately
  await mutate((all) => [{
    id: crypto.randomUUID(), kind: m.mode === "image" ? "image" : "video", modelId: m.id, modelName: m.name,
    prompt: params.prompt, taskId, url, state: url ? "success" : "pending", usd: url ? 0 : undefined, createdAt: Date.now(),
  }, ...all]);
  return Response.json({ ok: true });
}
