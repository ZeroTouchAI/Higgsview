// Sanity check for the model catalog: `npm run check`
import assert from "node:assert";
import { MODELS } from "../lib/models.ts";

const ids = new Set<string>();
for (const m of MODELS) {
  if (m.output === "text") continue; // text-AI tools run server-side (lib/run.ts TOOLS), not via build()
  assert(!ids.has(m.id), `duplicate id ${m.id}`);
  ids.add(m.id);
  assert(m.name && m.aspects.length && m.resolutions.length, `${m.id}: missing options`);
  const p = { prompt: "test", duration: m.durations[0] ?? 0, aspect: m.aspects[0], resolution: m.resolutions[0], audio: true, start: "https://x/a.png", end: "https://x/b.png", video: "https://x/v.mp4", taskId: "t1" };
  const out = m.build(p);
  if ("url" in out) assert(out.url.startsWith("https://"), `${m.id}: bad url`);
  else {
    assert(out.model, `${m.id}: no kie model`);
    assert(JSON.stringify(out.input).includes("test") || m.promptOptional, `${m.id}: prompt not passed`);
  }
}
console.log(`ok — ${MODELS.length} models`);

// Every App step must resolve to a real model and produce a valid request.
import { APPS, appStep, stepsOf } from "../lib/apps.ts";
const appIds = new Set<string>();
for (const app of APPS) {
  assert(!appIds.has(app.id), `duplicate app ${app.id}`);
  appIds.add(app.id);
  const input = { start: "https://x/a.png", end: "https://x/b.png", product: "https://x/p.png", video: "https://x/v.mp4", audioUrl: "https://x/a.mp3", text: "hello", choice: app.choice?.options[0], tier: "draft" as const };
  stepsOf(app, input).forEach((_, n) => {
    const { m, params } = appStep(app, n, input, n ? "https://x/prev.png" : undefined);
    const out = m.build(params);
    assert("url" in out || out.model, `${app.id} step ${n + 1}: no model`);
    for (const need of m.needs ?? []) assert(params[need], `${app.id} step ${n + 1}: ${m.id} missing ${need}`);
  });
}
console.log(`ok — ${APPS.length} apps`);

// Storyboard parsing: AI answers often wrap JSON in prose/code fences.
import { jsonOf, appById } from "../lib/apps.ts";
assert.deepEqual(jsonOf('Sure!\n```json\n{"scenes":[{"shot":"a","line":""}]}\n```'), { scenes: [{ shot: "a", line: "" }] });
assert.deepEqual(jsonOf("no json here"), {});
const kids = appById("script-to-video")!.fanout!({ tier: "draft" }, '{"scenes":[{"shot":"s1","line":"hi"},{"shot":"s2","line":""}]}');
assert.equal(kids.length, 2);
assert.ok(kids[0].input.text!.includes('"hi"') && kids.every((k) => appById(k.appId)));
const url = appById("url-to-video")!.fanout!({}, '{"narration":"n","scenes":["a","b","c"]}');
assert.deepEqual(url.map((k) => k.appId), ["scene-shot", "scene-shot", "scene-shot", "narration"]);
console.log("ok — storyboard fan-out");
