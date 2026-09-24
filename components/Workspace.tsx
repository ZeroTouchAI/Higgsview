"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MODELS, PRESETS, byId, estimateUsd, type Mode, type Model } from "@/lib/models";
import { refreshHistory, useHistory, type Item } from "@/lib/history";
import Feed from "@/components/Feed";
import { Chip, Upload } from "@/components/Controls";

const TABS: [Mode, string][] = [["create", "Create"], ["edit", "Edit"], ["motion", "Motion Control"], ["swap", "Genjutsu"]];
const TIER_LABEL = { free: "Free", budget: "Budget", standard: "Standard", premium: "Premium" };
type Media = { start?: string; end?: string; video?: string; videoSecs?: number };

export default function Workspace({ kind }: { kind: "video" | "image" }) {
  const sp = useSearchParams();
  const router = useRouter();
  const tab: Mode = kind === "image" ? "image" : ((sp.get("tab") as Mode) || "create");
  const models = MODELS.filter((m) => m.mode === tab);

  const [extendFrom, setExtendFrom] = useState<Item>();
  const [modelId, setModelId] = useState(sp.get("model") || models[0].id);
  const picked = byId(modelId);
  const model = extendFrom ? byId("grok-extend")! : picked?.mode === tab ? picked : models[0];
  const [prompt, setPrompt] = useState(sp.get("prompt") || "");
  const [preset, setPreset] = useState(PRESETS[0]);
  const [dur, setDuration] = useState(0);
  const [asp, setAspect] = useState("");
  const [res, setResolution] = useState("");
  // Fall back to the model's defaults when the chosen option isn't supported by the current model.
  const duration = model.durations.includes(dur) ? dur : model.durations[0] ?? 0;
  const aspect = model.aspects.includes(asp) ? asp : model.aspects[0];
  const resolution = model.resolutions.includes(res) ? res : model.resolutions.at(-1)!;
  const [audio, setAudio] = useState(true);
  const [media, setMedia] = useState<Media>({});
  const [refs, setRefs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState(false);
  const [presets, setPresets] = useState(sp.get("presets") === "1");
  const items = useHistory();

  const seconds = duration > 0 ? duration : media.videoSecs ?? 10;
  const cost = estimateUsd(model, seconds, resolution);
  const label = (k: "start" | "end" | "video", fallback: string) => model.labels?.[k] ?? fallback;

  async function generate() {
    if (cost > 2 && !confirm(`This will cost about $${cost.toFixed(2)} on Kie.ai. Continue?`)) return;
    setError("");
    setBusy(true);
    const fullPrompt = [prompt.trim(), preset.prompt].filter(Boolean).join(" ");
    const params = {
      prompt: fullPrompt, duration, aspect, resolution, audio: audio && !!model.audio,
      start: media.start, end: media.end, video: media.video, refs, taskId: extendFrom?.taskId,
    };
    try {
      const d = await fetch("/api/generate", { method: "POST", body: JSON.stringify({ modelId: model.id, params }) }).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setExtendFrom(undefined);
      await refreshHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const missing = [
    ...(model.needs ?? []).filter((n) => !media[n]).map((n) => label(n, n === "video" ? "Input video" : n === "end" ? "End frame" : "Start frame")),
    ...(!prompt.trim() && !model.promptOptional ? ["Prompt"] : []),
  ];
  const ready = !missing.length;

  return (
    <div className="flex flex-col gap-3 p-3 lg:h-[calc(100dvh-3.5rem)] lg:flex-row">
      {/* ---------- Left control panel ---------- */}
      <aside className="flex w-full shrink-0 flex-col gap-2 overflow-y-auto rounded-2xl bg-panel p-3 lg:w-[360px]">
        {kind === "video" && (
          <div role="tablist" className="flex gap-4 border-b border-line px-1 text-sm font-semibold whitespace-nowrap">
            {TABS.map(([t, name]) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setExtendFrom(undefined); router.replace(`/video?tab=${t}`); }}
                className={`-mb-px border-b-2 pb-2 transition-colors ${tab === t ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"}`}>
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Preset card (or the clip being extended) */}
        <div className="relative flex h-28 shrink-0 flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br from-[#3a2a12] via-[#1d1d1d] to-[#0f2a1f] p-3">
          {extendFrom ? (
            <>
              <button onClick={() => setExtendFrom(undefined)} className="absolute top-2 right-2 rounded-lg bg-black/50 px-2.5 py-1 text-xs font-semibold backdrop-blur hover:bg-black/70">✕ Cancel</button>
              <div className="text-xl font-black tracking-tight text-lime uppercase">Extend video</div>
              <div className="line-clamp-1 text-xs text-fg/80">{extendFrom.prompt}</div>
            </>
          ) : (
            <>
              <button onClick={() => setPresets(true)} className="absolute top-2 right-2 rounded-lg bg-black/50 px-2.5 py-1 text-xs font-semibold backdrop-blur hover:bg-black/70">✎ Change</button>
              <div className="text-xl font-black tracking-tight text-lime uppercase">{preset.name}</div>
              <div className="text-xs text-fg/80">{model.name}</div>
            </>
          )}
        </div>
        {!extendFrom && <p className="px-1 text-xs text-muted">{model.desc}</p>}

        {/* Inputs */}
        {(model.frames !== "none" || model.needs?.includes("video")) && (
          <div className="grid grid-cols-2 gap-2">
            {model.needs?.includes("video") && (
              <Upload label={label("video", "Input video")} accept="video/*" value={media.video} maxPixels={model.videoMaxPixels} maxSecs={model.videoMaxSecs}
                onChange={(video, videoSecs) => setMedia((m) => ({ ...m, video, videoSecs }))} />
            )}
            {model.frames !== "none" && (
              <Upload label={label("start", kind === "image" ? "Reference" : "Start frame")} accept="image/*"
                value={media.start} onChange={(start) => setMedia((m) => ({ ...m, start }))} optional={!model.needs?.includes("start")} />
            )}
            {model.frames === "start-end" && (
              <Upload label={label("end", "End frame")} accept="image/*" value={media.end} onChange={(end) => setMedia((m) => ({ ...m, end }))} optional={!model.needs?.includes("end")} />
            )}
          </div>
        )}
        {!!model.refs && (
          <div className="flex flex-col gap-1">
            <span className="px-1 text-xs font-semibold text-muted">Reference images ({refs.length}/{model.refs}) · refer to them as “image 1”, “image 2”…</span>
            <div className="grid grid-cols-4 gap-2">
              {refs.map((r, i) => (
                <div key={r} className="relative aspect-square overflow-hidden rounded-lg bg-chip">
                  <img src={r} alt={`Reference ${i + 1}`} className="size-full object-cover" />
                  <span className="absolute bottom-0.5 left-1 text-[10px] font-bold drop-shadow">{i + 1}</span>
                  <button onClick={() => setRefs(refs.filter((x) => x !== r))} aria-label={`Remove image ${i + 1}`} className="absolute top-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px]">✕</button>
                </div>
              ))}
              {refs.length < model.refs && (
                <div className="aspect-square"><Upload label="Add" accept="image/*" compact onChange={(u) => u && setRefs((r) => [...r, u])} /></div>
              )}
            </div>
          </div>
        )}

        {/* Prompt */}
        <label className="flex flex-col gap-1 rounded-xl bg-chip p-3">
          <span className="text-xs font-semibold text-muted">Prompt{model.promptOptional && " (optional)"}</span>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
            placeholder={
              extendFrom ? "What happens next? e.g. “The camera pulls back to reveal the whole city”"
                : model.id === "genjutsu-swap" ? "What to swap, e.g. “Replace the sneaker with the product in image 1”"
                : model.id === "genjutsu-motion" ? "e.g. “The woman in image 1 performs this, in the kitchen from image 2”"
                : kind === "image" ? "Describe the image you want…"
                : "Describe the scene, subject, action and camera — e.g. “A sneaker spinning on a wet neon street, slow motion”"}
            className="resize-none bg-transparent text-sm outline-none placeholder:text-muted/70" />
        </label>

        {model.audio && (
          <div className="flex items-center justify-between rounded-xl bg-chip px-3 py-2.5 text-sm">
            <span>🔊 Audio</span>
            <button role="switch" aria-checked={audio} aria-label="Generate audio" onClick={() => setAudio(!audio)}
              className={`relative h-5 w-9 rounded-full transition-colors ${audio ? "bg-lime" : "bg-line"}`}>
              <span className={`absolute top-0.5 size-4 rounded-full bg-black transition-all ${audio ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>
        )}

        {/* Model selector */}
        {!extendFrom && (
          <div className="relative">
            <button onClick={() => setPicker(!picker)} aria-expanded={picker}
              className="flex w-full items-center justify-between rounded-xl bg-chip px-3 py-2.5 text-left hover:bg-line">
              <span>
                <span className="block text-xs text-muted">Model</span>
                <span className="text-sm font-semibold">{model.name}</span>
              </span>
              <span className="text-muted">›</span>
            </button>
            {picker && <ModelPicker models={models} value={model.id} onPick={(id) => { setModelId(id); setPicker(false); }} onClose={() => setPicker(false)} />}
          </div>
        )}

        {/* Option chips */}
        <div className="flex flex-wrap gap-2">
          {model.durations.length > 1 && <Chip label="Duration" value={duration} options={model.durations} fmt={(d) => `${extendFrom ? "+" : ""}${d}s`} onChange={(v) => setDuration(Number(v))} />}
          {model.durations[0] === -1 && <span className="rounded-lg bg-chip px-3 py-1.5 text-sm text-muted">Length: matches video</span>}
          {model.aspects.length > 1 && <Chip label="Aspect ratio" value={aspect} options={model.aspects} onChange={setAspect} />}
          {model.resolutions.length > 1 && <Chip label="Quality" value={resolution} options={model.resolutions} onChange={setResolution} />}
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        {/* Pinned to the panel bottom so it never scrolls out of view */}
        <div className="sticky bottom-0 -mx-3 -mb-3 mt-auto flex flex-col gap-1 bg-panel p-3 pt-2">
          <button onClick={generate} disabled={busy || !ready}
            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-bold text-black shadow-[0_0_24px_rgba(209,254,23,.25)] transition hover:brightness-110 disabled:opacity-40">
            {busy ? "Sending…" : extendFrom ? "Extend" : "Generate"} <span className="rounded-md bg-black/10 px-1.5 text-xs">✦ {cost === 0 ? "Free" : `≈$${cost.toFixed(2)}`}</span>
          </button>
          {!busy && missing.length > 0 && <p className="text-center text-[11px] text-muted">Add: {missing.join(", ")}</p>}
        </div>
      </aside>

      {/* ---------- Right: results ---------- */}
      <main className="min-h-[60vh] flex-1 overflow-y-auto rounded-2xl bg-panel/40 p-3">
        <Feed items={items.filter((i) => i.kind === kind || (kind === "video" && byId(i.modelId)?.mode !== "image"))} kind={kind}
          onReuse={(i) => { setPrompt(i.prompt); if (byId(i.modelId)?.mode === tab) setModelId(i.modelId); }}
          onContinue={kind === "video" ? (i) => {
            // Chain clips: the last frame of this clip becomes the start frame of the next.
            if (tab !== "create") router.replace("/video?tab=create");
            setExtendFrom(undefined); setMedia({ start: i.lastFrame }); setPrompt("");
            if (byId(i.modelId)?.mode === "create") setModelId(i.modelId);
          } : undefined}
          onExtend={kind === "video" ? (i) => { setExtendFrom(i); setPrompt(""); } : undefined} />
      </main>

      {presets && <PresetModal onPick={(p) => { setPreset(p); setPresets(false); }} onClose={() => setPresets(false)} />}
    </div>
  );
}

function ModelPicker({ models, value, onPick, onClose }: { models: Model[]; value: string; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => models.filter((m) => m.name.toLowerCase().includes(q.toLowerCase())), [models, q]);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-line bg-[#1a1a1a] p-2 shadow-2xl lg:inset-x-auto lg:top-20 lg:bottom-auto lg:left-[384px] lg:w-[360px]">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search models"
          className="mb-2 w-full rounded-lg bg-chip px-3 py-2 text-sm outline-none" />
        <p className="px-2 pb-1 text-xs text-muted">✦ Featured models</p>
        <ul className="max-h-[60vh] overflow-y-auto">
          {list.map((m) => {
            const c = estimateUsd(m, m.durations[0] > 0 ? m.durations[0] : 10, m.resolutions[0]); // cheapest setting
            return (
              <li key={m.id}>
                <button onClick={() => onPick(m.id)} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-chip ${m.id === value ? "bg-chip" : ""}`}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-line text-sm">▮▮</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {m.name}
                      {m.badge && <span className={`rounded px-1 text-[10px] font-black italic ${m.badge === "FREE" || m.badge === "CHEAP" ? "bg-lime text-black" : "bg-gradient-to-r from-sky-500 to-violet-500"}`}>{m.badge}</span>}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted">
                      <span className="rounded bg-line px-1">{m.resolutions.at(-1)}</span>
                      {m.durations[0] > 0 && <span className="rounded bg-line px-1">{m.durations[0]}s-{m.durations.at(-1)}s</span>}
                      <span className="rounded bg-line px-1">{TIER_LABEL[m.tier]} · {c === 0 ? "Free" : `from ≈$${c.toFixed(2)}`}</span>
                    </span>
                  </span>
                  {m.id === value && <span className="text-lime">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

function PresetModal({ onPick, onClose }: { onPick: (p: (typeof PRESETS)[number]) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Presets" className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-panel p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase">Presets</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg bg-chip px-2">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((p, i) => (
            <button key={p.name} onClick={() => onPick(p)}
              className="flex aspect-[4/5] flex-col justify-end rounded-xl p-3 text-left ring-lime hover:ring-2"
              style={{ background: `linear-gradient(160deg, hsl(${(i * 47) % 360} 45% 22%), #111)` }}>
              <span className="text-sm font-black uppercase">{p.name}</span>
              <span className="line-clamp-2 text-[11px] text-fg/60">{p.prompt || "Manual control"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
