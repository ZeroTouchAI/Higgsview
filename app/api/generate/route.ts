import { byId, type Params } from "@/lib/models";
import { appById, appStep, type AppInput } from "@/lib/apps";
import { advance, runModel, validate } from "@/lib/run";
import { mutate } from "@/lib/store";
import type { Item } from "@/lib/history";

// Body: { modelId, params } for the studio, or { appId, input } for an App.
export async function POST(req: Request) {
  const body = (await req.json()) as { modelId?: string; params?: Params; appId?: string; input?: AppInput; group?: string; label?: string;
    next?: Item["next"]; continueFrom?: string; frame?: string };
  if (body.continueFrom) return continuePart(body.continueFrom, body.frame ?? "");
  const app = body.appId ? appById(body.appId) : undefined;
  if (body.appId && !app) return Response.json({ error: "Unknown app" }, { status: 400 });
  const items: Item[] = [];

  try {
    if (app) {
      const input = body.input ?? {};
      const missing = app.inputs.find(([k]) => !input[k]);
      if (missing) return Response.json({ error: `${app.name} needs ${missing[1]}` }, { status: 400 });
      if (!app.inputs.length && app.optional && !app.optional.some(([k]) => input[k]) && !input.text?.trim())
        return Response.json({ error: "Add a photo or describe the shot" }, { status: 400 });
      if (app.text && !app.text.optional && !input.text?.trim()) return Response.json({ error: `${app.text.label} is required` }, { status: 400 });

      const id = crypto.randomUUID();
      const r = await advance(app, input, 0);
      items.push({ id, kind: app.out, modelId: appStep(app, 0, input).m.id, modelName: app.name, prompt: input.text || app.name, createdAt: Date.now(), ...r, usd: r.state === "success" ? 0 : undefined });
      // Storyboard-style apps: start one extra job per scene, grouped under this item.
      if (r.state === "success" && app.fanout) {
        items[0].group = id;
        for (const kid of app.fanout(input, r.text ?? "")) {
          const ka = appById(kid.appId)!;
          const kr = await advance(ka, kid.input, 0);
          items.push({ id: crypto.randomUUID(), kind: ka.out, modelId: appStep(ka, 0, kid.input).m.id, modelName: `${app.name} · ${kid.label}`, prompt: kid.input.text || kid.label, group: id, createdAt: items[0].createdAt - items.length, ...kr, usd: kr.state === "success" ? 0 : undefined });
        }
      }
    } else {
      const m = byId(body.modelId ?? "");
      if (!m) return Response.json({ error: "Unknown model" }, { status: 400 });
      const params = body.params!;
      const err = validate(m, params);
      if (err) return Response.json({ error: err }, { status: 400 });
      const r = await runModel(m, params);
      items.push({
        id: crypto.randomUUID(), kind: m.output ?? (m.mode === "image" ? "image" : "video"), modelId: m.id,
        modelName: body.label ? `${m.name} · ${body.label}` : m.name, prompt: params.prompt, params, group: body.group, next: body.next,
        taskId: r.taskId, url: r.url, text: r.text, state: r.taskId ? "pending" : "success", usd: r.taskId ? undefined : 0, createdAt: Date.now(),
      });
    }
  } catch (e) {
    if (!items.length) return Response.json({ error: (e as Error).message }, { status: 502 });
  }

  // Kie tasks already exist (and cost money): if saving fails, say so loudly with their ids.
  try {
    await mutate((all) => [...items.slice().reverse(), ...all].sort((a, b) => b.createdAt - a.createdAt));
  } catch (e) {
    return Response.json({ error: `Started (${items.map((i) => i.taskId).join(", ")}) but couldn't save to History: ${(e as Error).message}` }, { status: 500 });
  }
  return Response.json({ ok: true, ids: items.map((i) => i.id) });
}

// Split video, part 2+: the browser sends the finished part's last frame. Claim the waiting part exactly once
// (several open tabs may try), then run it with that frame as an extra reference so the swapped faces carry over.
async function continuePart(id: string, frame: string) {
  let prev: Item | undefined;
  await mutate((all) => { prev = undefined; return all.map((i) => (i.id === id && i.next ? ((prev = i), { ...i, next: undefined }) : i)); });
  if (!prev?.next || !prev.params) return Response.json({ ok: true, ids: [] }); // already started
  const m = byId(prev.modelId)!;
  const refs = prev.params.refs ?? [];
  const carry = frame && refs.length < (m.refs ?? 0);
  const params: Params = {
    ...prev.params, video: prev.next.video, refs: carry ? [...refs, frame] : refs,
    prompt: carry ? `${prev.params.prompt} Image ${refs.length + 1} is a frame from the previous part of this same video: every swapped person must look exactly like they do in image ${refs.length + 1}.`.trim() : prev.params.prompt,
  };
  const item: Item = { id: crypto.randomUUID(), kind: prev.kind, modelId: m.id, modelName: `${m.name} · ${prev.next.label}`, prompt: prev.prompt, params, group: prev.group, state: "pending", createdAt: Date.now() };
  try {
    const r = await runModel(m, params);
    Object.assign(item, { taskId: r.taskId, url: r.url, state: r.taskId ? "pending" : "success" });
  } catch (e) {
    Object.assign(item, { state: "fail", error: (e as Error).message, usd: 0 });
  }
  await mutate((all) => [item, ...all]);
  return Response.json({ ok: true, ids: [item.id] });
}
