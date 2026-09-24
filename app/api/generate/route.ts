import { byId, type Params } from "@/lib/models";
import { appById, appStep, type AppInput } from "@/lib/apps";
import { runModel, validate } from "@/lib/run";
import { mutate } from "@/lib/store";

// Body: { modelId, params } for the studio, or { appId, input } for an App (runs its first step).
export async function POST(req: Request) {
  const body = (await req.json()) as { modelId?: string; params?: Params; appId?: string; input?: AppInput };
  const app = body.appId ? appById(body.appId) : undefined;
  if (body.appId && !app) return Response.json({ error: "Unknown app" }, { status: 400 });

  let m, params: Params;
  if (app) {
    const missing = app.inputs.find(([k]) => !body.input?.[k]);
    if (missing) return Response.json({ error: `${app.name} needs ${missing[1]}` }, { status: 400 });
    if (app.text && !app.text.optional && !body.input?.text?.trim()) return Response.json({ error: `${app.text.label} is required` }, { status: 400 });
    ({ m, params } = appStep(app, 0, body.input!));
  } else {
    m = byId(body.modelId ?? "");
    if (!m) return Response.json({ error: "Unknown model" }, { status: 400 });
    params = body.params!;
    const err = validate(m, params);
    if (err) return Response.json({ error: err }, { status: 400 });
  }

  let run;
  try {
    run = await runModel(m, params);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
  // The Kie task already exists (and costs money): if saving fails, say so loudly with its id.
  try { await mutate((all) => [{
    id: crypto.randomUUID(),
    kind: app?.out ?? m.output ?? (m.mode === "image" ? "image" : "video"),
    modelId: m.id, modelName: app?.name ?? m.name, prompt: app ? body.input?.text || app.name : params.prompt,
    taskId: run.taskId, url: run.url, state: run.url ? "success" : "pending", usd: run.url ? 0 : undefined, createdAt: Date.now(),
    ...(app && { app: { id: app.id, input: body.input!, step: 0 } }),
  }, ...all]); } catch (e) {
    return Response.json({ error: `Started (Kie task ${run.taskId}) but couldn't save it to History: ${(e as Error).message}` }, { status: 500 });
  }
  return Response.json({ ok: true });
}
