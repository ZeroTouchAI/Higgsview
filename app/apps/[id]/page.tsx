"use client";
import { askToPay } from "@/components/Dialog";
import Link from "next/link";
import { use, useState } from "react";
import { APPS, appById, appCost, stepsOf, type AppInput, type Tier } from "@/lib/apps";
import { byId } from "@/lib/models";
import { refreshHistory, useHistory } from "@/lib/history";
import { Chip, Upload } from "@/components/Controls";
import Feed from "@/components/Feed";

const TIERS: [Tier, string][] = [["draft", "Draft"], ["standard", "Standard"], ["premium", "Premium"]];

export default function AppPage({ params }: PageProps<"/apps/[id]">) {
  const { id } = use(params);
  const app = appById(id);
  const [input, setInput] = useState<AppInput>({ tier: "standard" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState(false);
  const all = useHistory();
  const mine = new Set(all.filter((i) => i.app?.id === id).map((i) => i.id));
  const items = all.filter((i) => mine.has(i.id) || (i.group && mine.has(i.group)));
  if (!app) return <p className="p-8">App not found. <Link href="/apps" className="text-lime">Back to Apps</Link></p>;

  const set = (patch: Partial<AppInput>) => setInput((i) => ({ ...i, ...patch }));
  const steps = stepsOf(app, input);
  const hasVideoStep = steps.some((s) => byId(s(input, "x").modelId)?.mode === "create");
  const choice = input.choice ?? app.choice?.options[0];
  // The model that receives the uploaded video decides its size/length limits (auto-fixed in the browser).
  const videoModel = stepsOf(app, { ...input, video: input.video ?? "x" }).map((s) => byId(s({ ...input, video: "x" }, "x").modelId)).find((m) => m?.needs?.includes("video"));
  const cost = appCost(app, { ...input, choice });
  const ready = app.inputs.every(([k]) => input[k]) && (!app.text || app.text.optional || input.text?.trim())
    && (app.inputs.length > 0 || !app.optional || app.optional.some(([k]) => input[k]) || !!input.text?.trim());

  async function run() {
    if (cost > 2 && !(await askToPay(cost))) return;
    setBusy(true); setError("");
    try {
      const d = await fetch("/api/generate", { method: "POST", body: JSON.stringify({ appId: id, input: { ...input, choice } }) }).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      await refreshHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 lg:h-[calc(100dvh-3.5rem)] lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl bg-panel p-3 lg:w-[360px]">
        <Link href="/apps" className="text-xs text-muted hover:text-fg">← All apps</Link>
        <div className="relative flex h-36 shrink-0 flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br from-[#3a2a12] via-[#1d1d1d] to-[#0f2a1f] p-3">
          <img src={`/thumbs/${app.id}.jpg`} alt="" className="absolute inset-0 size-full object-cover opacity-80" onError={(e) => (e.currentTarget.style.display = "none")} />
          <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          {app.cat === "effects" && <button onClick={() => setPicker(true)} className="absolute top-2 right-2 z-10 rounded-lg bg-black/50 px-2.5 py-1 text-xs font-semibold backdrop-blur hover:bg-black/70">✎ Change</button>}
          <div className="relative text-xl font-black tracking-tight text-lime uppercase">{app.name}</div>
          <div className="relative text-xs text-fg/80">{app.desc}</div>
        </div>

        {(app.inputs.length > 0 || app.optional) && (
          <div className="grid grid-cols-2 gap-2">
            {[...app.inputs, ...(app.optional ?? [])].map(([k, label]) => (
              <Upload key={k} label={label} accept={k === "video" ? "video/*" : k === "audioUrl" ? "audio/*" : "image/*"}
                value={input[k]} onChange={(url) => set({ [k]: url })} optional={app.optional?.some(([o]) => o === k)}
                maxPixels={k === "video" ? videoModel?.videoMaxPixels : undefined} maxSecs={k === "video" ? videoModel?.videoMaxSecs : undefined} minSide={k === "video" ? videoModel?.videoMinSide : undefined} />
            ))}
          </div>
        )}

        {app.text && (
          <label className="flex flex-col gap-1 rounded-xl bg-chip p-3">
            <span className="text-xs font-semibold text-muted">{app.text.label}{app.text.optional && " (optional)"}</span>
            <textarea rows={4} value={input.text ?? ""} onChange={(e) => set({ text: e.target.value })} placeholder={app.text.placeholder}
              className="resize-none bg-transparent text-sm outline-none placeholder:text-muted/70" />
          </label>
        )}

        <div className="flex flex-wrap gap-2">
          {app.choice && <Chip label={app.choice.label} value={choice!} options={app.choice.options} onChange={(v) => set({ choice: v })} />}
        </div>

        {hasVideoStep && (
          <div role="radiogroup" aria-label="Quality" className="grid grid-cols-3 gap-1 rounded-xl bg-chip p-1 text-sm">
            {TIERS.map(([t, label]) => (
              <button key={t} role="radio" aria-checked={input.tier === t} onClick={() => set({ tier: t })}
                className={`rounded-lg py-1.5 font-semibold ${input.tier === t ? "bg-fg text-black" : "text-muted hover:text-fg"}`}>
                {label}<span className="block text-[10px] font-normal opacity-70">≈${appCost(app, { ...input, choice, tier: t }).toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        {/* Pinned to the panel bottom so it never scrolls out of view */}
        <div className="sticky bottom-0 -mx-3 -mb-3 mt-auto flex flex-col gap-1 bg-panel p-3 pt-2">
          <button onClick={run} disabled={busy || !ready}
            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-bold text-black shadow-[0_0_24px_rgba(209,254,23,.25)] hover:brightness-110 disabled:opacity-40">
            {busy ? (app.out === "text" || app.fanout ? "Thinking…" : "Sending…") : app.fanout ? "Create scenes" : app.out === "text" ? "Analyze" : `Generate ${app.out === "video" ? "Video" : app.out === "audio" ? "Audio" : "Image"}`}
            <span className="rounded-md bg-black/10 px-1.5 text-xs">✦ ≈${cost.toFixed(2)}</span>
          </button>
          {steps.length > 1 && <p className="text-center text-[11px] text-muted">Runs {steps.length} steps automatically. Keep this page open or check History.</p>}
        </div>
      </aside>
      <main className="min-h-[60vh] flex-1 overflow-y-auto rounded-2xl bg-panel/40 p-3">
        <Feed items={items} kind={app.out === "text" ? "video" : app.out} />
      </main>
      {picker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setPicker(false)}>
          <div role="dialog" aria-label="Effects" className="max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-panel p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black uppercase">Effects</h2>
              <button onClick={() => setPicker(false)} aria-label="Close" className="rounded-lg bg-chip px-2">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {APPS.filter((a) => a.cat === "effects").map((a, n) => (
                <Link key={a.id} href={`/apps/${a.id}`} className={`relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-xl p-3 ring-lime hover:ring-2 ${a.id === id ? "ring-2" : ""}`}
                  style={{ background: `linear-gradient(160deg, hsl(${(n * 47) % 360} 50% 24%), #111)` }}>
                  <img src={`/thumbs/${a.id}.jpg`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                  <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 to-transparent" />
                  <span className="relative text-sm font-black uppercase">{a.name}</span>
                  <span className="relative line-clamp-2 text-[11px] text-fg/70">{a.desc}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
