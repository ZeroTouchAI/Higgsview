"use client";
import Link from "next/link";
import { use, useState } from "react";
import { appById, appCost, type AppInput, type Tier } from "@/lib/apps";
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
  const items = useHistory().filter((i) => i.app?.id === id);
  if (!app) return <p className="p-8">App not found. <Link href="/apps" className="text-lime">Back to Apps</Link></p>;

  const set = (patch: Partial<AppInput>) => setInput((i) => ({ ...i, ...patch }));
  const hasVideoStep = app.steps.some((s) => s(input, "x").modelId.startsWith("seedance"));
  const choice = input.choice ?? app.choice?.options[0];
  const cost = appCost(app, { ...input, choice });
  const ready = app.inputs.every(([k]) => input[k]) && (!app.text || app.text.optional || input.text?.trim());

  async function run() {
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
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:h-[calc(100vh-3.5rem)] lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl bg-panel p-3 lg:w-[360px]">
        <Link href="/apps" className="text-xs text-muted hover:text-fg">← All apps</Link>
        <div className="flex h-28 shrink-0 flex-col justify-end rounded-xl bg-gradient-to-br from-[#3a2a12] via-[#1d1d1d] to-[#0f2a1f] p-3">
          <div className="text-xl font-black tracking-tight text-lime uppercase">{app.name}</div>
          <div className="text-xs text-fg/80">{app.desc}</div>
        </div>

        {app.inputs.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {app.inputs.map(([k, label]) => (
              <Upload key={k} label={label} accept={k === "video" ? "video/*" : k === "audioUrl" ? "audio/*" : "image/*"}
                value={input[k]} onChange={(url) => set({ [k]: url })} />
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
        <button onClick={run} disabled={busy || !ready}
          className="mt-auto flex shrink-0 items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-bold text-black shadow-[0_0_24px_rgba(209,254,23,.25)] hover:brightness-110 disabled:opacity-40">
          {busy ? "Sending…" : `Generate ${app.out === "video" ? "Video" : app.out === "audio" ? "Audio" : "Image"}`}
          <span className="rounded-md bg-black/10 px-1.5 text-xs">✦ ≈${cost.toFixed(2)}</span>
        </button>
        {app.steps.length > 1 && <p className="text-center text-[11px] text-muted">Runs {app.steps.length} steps automatically. Keep this page open or check History.</p>}
      </aside>
      <main className="min-h-[60vh] flex-1 overflow-y-auto rounded-2xl bg-panel/40 p-3">
        <Feed items={items} kind={app.out === "image" ? "image" : "video"} />
      </main>
    </div>
  );
}
