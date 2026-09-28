import { kie } from "@/lib/kie";
import { appById, stepsOf } from "@/lib/apps";
import { advance } from "@/lib/run";
import { mutate, readHistory } from "@/lib/store";
import type { Item } from "@/lib/history";

// Turn cryptic provider errors into what to do next.
function explain(msg: string) {
  if (/sensitive|real person|real human|likeness/i.test(msg))
    return `${msg} Seedance blocks real people's faces. For real people use "Genjutsu · Real People (Kling Omni)" or "Character Swap (full body)" in the Genjutsu tab.`;
  return msg;
}

// GET: all items. Pending Kie tasks are checked first, so polling this endpoint advances them
// (and starts the next step of multi-step Apps).
export async function GET() {
  const { items } = await readHistory();
  const pending = items.filter((i) => i.state === "pending" && i.taskId);
  if (!pending.length) return Response.json(items);

  const done: Record<string, Partial<Item>> = {};
  await Promise.all(pending.map(async (i) => {
    try {
      const d = await kie(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(i.taskId!)}`);
      if (d.state !== "success" && d.state !== "fail") return;
      const r = d.resultJson ? JSON.parse(d.resultJson) : {};
      const usd = (i.usd ?? 0) + (d.creditsConsumed ?? 0) * 0.005; // running total across App steps; 1 Kie credit = $0.005
      if (d.state === "fail") return void (done[i.id] = { state: "fail", error: explain(d.failMsg || "Generation failed"), usd });
      // Most models return resultUrls; others (e.g. Suno) nest the file URL elsewhere, so fall back to the first media URL.
      const url: string | undefined = r.resultUrls?.[0] ?? String(d.resultJson ?? "").match(/https?:\/\/[^"'\s]+\.(?:mp3|wav|m4a|mp4|mov|webm|png|jpe?g|webp)/i)?.[0];
      const app = i.app && appById(i.app.id);
      if (app && i.app!.step + 1 < stepsOf(app, i.app!.input).length && url) {
        const step = i.app!.step + 1;
        try {
          // Runs any instant steps and starts the next Kie task (or finishes).
          done[i.id] = { ...(await advance(app, i.app!.input, step, url, i.app!.notes)), usd };
        } catch (e) {
          done[i.id] = { state: "fail", error: `Step ${step + 1} failed: ${(e as Error).message}`, url, usd };
        }
      } else {
        done[i.id] = { state: "success", url, lastFrame: r.lastFrameUrl?.[0], usd };
      }
    } catch {} // transient Kie error: try again on the next poll
  }));
  if (!Object.keys(done).length) return Response.json(items);
  return Response.json(await mutate((all) => all.map((i) => (done[i.id] ? { ...i, ...done[i.id] } : i))));
}

// POST: import items (one-time migration of old per-browser localStorage history).
export async function POST(req: Request) {
  const incoming = (await req.json()) as Item[];
  if (!Array.isArray(incoming)) return Response.json({ error: "array required" }, { status: 400 });
  const next = await mutate((all) => {
    const ids = new Set(all.map((i) => i.id));
    return [...incoming.filter((i) => i?.id && !ids.has(i.id)), ...all].sort((a, b) => b.createdAt - a.createdAt);
  });
  return Response.json(next);
}

// DELETE hides the item (kept for the Spending page), or with ?gone=1 marks its file as expired at Kie.
export async function DELETE(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("id");
  // ?gone=1: the browser found the result file deleted at Kie; the item leaves History (unless saved to Drive).
  const change = q.get("gone") ? { gone: true } : { hidden: true };
  return Response.json(await mutate((all) => all.map((i) => (i.id === id ? { ...i, ...change } : i))));
}
