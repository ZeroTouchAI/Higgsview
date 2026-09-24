// Runs model calls and walks multi-step Apps.
import { chat, kie } from "@/lib/kie";
import type { Model, Params } from "@/lib/models";
import { appStep, stepsOf, type App, type AppInput } from "@/lib/apps";

type Result = { taskId?: string; url?: string; text?: string };

// Instant server-side tools (no Kie task to poll): text/vision AI and web-page reading.
const TOOLS: Record<string, (p: Params) => Promise<Result>> = {
  // prompt = instruction; start/video/audioUrl = media for the AI to look at or listen to.
  "gemini-text": async (p) => ({ text: await chat(p.prompt, [p.start, p.video, p.audioUrl].filter(Boolean) as string[]) }),
  // prompt = "<url>\n<instruction>": fetches the page, hands its text to the AI, returns the AI's answer + the page's main image.
  "page-brief": async (p) => {
    const [url, ...rest] = p.prompt.split("\n");
    if (!/^https?:\/\//.test(url.trim())) throw new Error("Paste a full link starting with https://");
    const html = await fetch(url.trim(), { headers: { "User-Agent": "Mozilla/5.0 (Higgsview)" } }).then((r) => r.text());
    const meta = (k: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']+)`, "i"))?.[1];
    const image = meta("og:image") ?? meta("twitter:image");
    const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 6000);
    const text = await chat(`${rest.join("\n")}\n\nPAGE URL: ${url}\nTITLE: ${html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? ""}\nDESCRIPTION: ${meta("og:description") ?? meta("description") ?? ""}\nPAGE TEXT: ${body}`);
    return { text, url: image ? new URL(image, url.trim()).href : undefined };
  },
};

export async function runModel(m: Model, params: Params): Promise<Result> {
  if (TOOLS[m.id]) return TOOLS[m.id](params);
  const body = m.build(params);
  if ("url" in body) return { url: body.url };
  const d = await kie("/api/v1/jobs/createTask", { method: "POST", body: JSON.stringify(body) });
  return { taskId: d.taskId };
}

export function validate(m: Model, params: Params) {
  if (!params.prompt?.trim() && !m.promptOptional) return "Prompt is required";
  for (const need of m.needs ?? []) if (!params[need]) return `${m.name} needs ${m.labels?.[need] ?? need}`;
}

// Walks an App from step `n`. Instant steps (text AI, page reading, free images) run right away and pass on
// their URL (`prev`) and text (`notes`); it stops at the first Kie task, which the history poller resumes.
export async function advance(app: App, input: AppInput, n: number, prev?: string, notes?: string) {
  const steps = stepsOf(app, input);
  for (let k = n; k < steps.length; k++) {
    const { m, params } = appStep(app, k, input, prev, notes);
    const r = await runModel(m, params);
    if (r.taskId) return { state: "pending" as const, taskId: r.taskId, app: { id: app.id, input, step: k, notes } };
    prev = r.url ?? prev;
    notes = r.text ?? notes;
  }
  return { state: "success" as const, url: prev, text: notes, app: { id: app.id, input, step: steps.length - 1, notes } };
}
