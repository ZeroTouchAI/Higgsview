"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MODELS, PRESETS, byId, estimateUsd, type Mode, type Model } from "@/lib/models";
import { refreshHistory, useHistory, type Item } from "@/lib/history";
import Feed from "@/components/Feed";

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
  const cost = estimateUsd(model, seconds);
  const label = (k: "start" | "end" | "video", fallback: string) => model.labels?.[k] ?? fallback;

  async function generate() {
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

  const ready = (prompt.trim() || model.promptOptional) && (model.needs ?? []).every((n) => media[n]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:h-[calc(100vh-3.5rem)] lg:flex-row">
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
              <Upload label={label("video", "Input video")} accept="video/*" value={media.video} maxPixels={model.videoMaxPixels}
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

        <button onClick={generate} disabled={busy || !ready}
          className="mt-auto flex shrink-0 items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-bold text-black shadow-[0_0_24px_rgba(209,254,23,.25)] transition hover:brightness-110 disabled:opacity-40">
          {busy ? "Sending…" : extendFrom ? "Extend" : "Generate"} <span className="rounded-md bg-black/10 px-1.5 text-xs">✦ {cost === 0 ? "Free" : `≈$${cost.toFixed(2)}`}</span>
        </button>
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

// Uploads straight from the browser to our Blob store via a presigned URL (any size), then returns a URL Kie can read.
function Upload({ label, accept, value, onChange, optional, maxPixels, compact }: {
  label: string; accept: string; value?: string; onChange: (url?: string, seconds?: number) => void;
  optional?: boolean; maxPixels?: number; compact?: boolean;
}) {
  const [status, setStatus] = useState(""); // non-empty while converting/uploading
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function pick(f?: File) {
    if (!f) return;
    setErr("");
    let seconds: number | undefined;
    setStatus("Reading…");
    try {
      if (f.type.startsWith("video/")) {
        const meta = await videoMeta(f);
        seconds = meta?.seconds;
        // Seedance only takes ~480p–720p (409,600–927,408 px) and ≤30s: shrink/trim it here instead of making you re-export.
        if (maxPixels && meta && (meta.w * meta.h > maxPixels || meta.w * meta.h < 409600 || meta.seconds > 30)) {
          const k = Math.sqrt((meta.w * meta.h > maxPixels || meta.w * meta.h < 409600 ? 921600 : meta.w * meta.h) / (meta.w * meta.h));
          const even = (n: number) => Math.round((n * k) / 2) * 2;
          f = await resizeVideo(f, even(meta.w), even(meta.h), 30, (p) => setStatus(`Converting to ${even(meta.w)}×${even(meta.h)}… ${p}%`));
          seconds = Math.min(meta.seconds, 30);
        }
      }
      setStatus("Uploading…");
      const d = await fetch("/api/upload", { method: "POST", body: JSON.stringify({ name: f.name, type: f.type, size: f.size }) }).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      const put = await fetch(d.putUrl, { method: "PUT", body: f, headers: { "Content-Type": f.type } });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      onChange(d.getUrl, seconds);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setStatus("");
    }
  }
  return (
    <div className={`relative overflow-hidden rounded-xl border border-dashed border-line bg-chip text-center text-xs ${compact ? "size-full" : "aspect-[4/3]"}`}>
      <button type="button" onClick={() => input.current?.click()} className="flex size-full flex-col items-center justify-center gap-1 p-2 hover:bg-line"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}>
        {value ? (accept.startsWith("video") ? <video src={value} muted className="absolute inset-0 size-full object-cover" /> : <img src={value} alt={label} className="absolute inset-0 size-full object-cover" />)
          : <><span className="text-lg">＋</span><span className="font-semibold">{status || label}</span>
            {!compact && <span className={err ? "text-red-300" : "text-muted"}>{err || (optional ? "Optional" : "Required")}</span>}</>}
      </button>
      {value && <button onClick={() => onChange(undefined)} aria-label={`Remove ${label}`} className="absolute top-1 right-1 rounded-md bg-black/70 px-1.5">✕</button>}
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

// Re-encode a video in the browser (canvas + MediaRecorder, native in Chrome/Edge): resize to w×h, cut at maxSecs, keep audio.
// ponytail: plays in real time (a 30s clip takes ~30s) and needs MP4 MediaRecorder support; ffmpeg.wasm if other browsers matter.
async function resizeVideo(f: File, w: number, h: number, maxSecs: number, progress: (pct: number) => void): Promise<File> {
  const mimeType = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) throw new Error("This browser can't convert video. Use Chrome or Edge, or export the video at 720p.");
  const v = document.createElement("video");
  v.src = URL.createObjectURL(f);
  v.playsInline = true;
  await new Promise((r) => (v.onloadedmetadata = r));
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = canvas.getContext("2d")!;
  const stream = canvas.captureStream(30);
  // Route audio into the recording without playing it out loud.
  const audio = new AudioContext();
  const dest = audio.createMediaStreamDestination();
  audio.createMediaElementSource(v).connect(dest);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  const end = Math.min(v.duration, maxSecs);
  const draw = () => {
    ctx.drawImage(v, 0, 0, w, h);
    progress(Math.min(99, Math.round((v.currentTime / end) * 100)));
    if (v.currentTime >= end || v.ended) { if (rec.state === "recording") { v.pause(); rec.stop(); } }
    else v.requestVideoFrameCallback(draw);
  };
  v.onended = () => rec.state === "recording" && rec.stop();
  rec.start(1000);
  await v.play();
  v.requestVideoFrameCallback(draw);
  await done;
  audio.close();
  URL.revokeObjectURL(v.src);
  return new File(chunks, f.name.replace(/\.\w+$/, "") + "-720p.mp4", { type: "video/mp4" });
}

function videoMeta(f: File): Promise<{ w: number; h: number; seconds: number } | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve({ w: v.videoWidth, h: v.videoHeight, seconds: Math.round(v.duration) }); URL.revokeObjectURL(v.src); };
    v.onerror = () => resolve(undefined);
    v.src = URL.createObjectURL(f);
  });
}

function Chip<T extends string | number>({ label, value, options, onChange, fmt = String }: { label: string; value: T; options: T[]; onChange: (v: string) => void; fmt?: (v: T) => string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer appearance-none rounded-lg bg-chip px-3 py-1.5 text-sm font-medium outline-none hover:bg-line focus:ring-2 focus:ring-lime">
      {options.map((o) => <option key={o} value={o}>{fmt(o)}</option>)}
    </select>
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
            const c = estimateUsd(m, m.durations[0] ?? 0) || estimateUsd(m, 10);
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
                      <span className="rounded bg-line px-1">{TIER_LABEL[m.tier]} · {c === 0 ? "Free" : `≈$${c.toFixed(2)}`}</span>
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
