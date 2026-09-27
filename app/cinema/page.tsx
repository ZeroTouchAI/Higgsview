"use client";
import { askToPay } from "@/components/Dialog";
import { useState } from "react";
import { byId, defaultRes, estimateUsd } from "@/lib/models";
import { refreshHistory, useHistory } from "@/lib/history";
import { Chip, Upload } from "@/components/Controls";
import Feed from "@/components/Feed";

// Higgsfield Cinema Studio: pick a camera, lens, focal length and up to 3 stacked moves; we turn them into
// director-grade prompt language and send it to the chosen model.
const CAMERAS = ["Modular 8K Digital", "ARRI Alexa 35", "RED V-Raptor", "Sony Venice 2", "IMAX 70mm Film", "35mm Film", "16mm Film", "Super 8", "VHS Camcorder", "iPhone Vlog"];
const LENSES = ["Classic Anamorphic", "Modern Anamorphic", "Vintage Spherical", "Clean Spherical Prime", "Macro", "Tilt-Shift", "Fisheye", "Soft Diffusion"];
const FOCALS = ["14mm", "24mm", "35mm", "50mm", "85mm", "135mm"];
const APERTURES = ["f/1.4 shallow", "f/2.8", "f/5.6", "f/11 deep focus"];
const MOVES = ["Dolly In", "Dolly Out", "Pan Left", "Pan Right", "Tilt Up", "Tilt Down", "Truck Left", "Truck Right", "Crane Up", "Crane Down", "Orbit", "Handheld", "Crash Zoom", "Whip Pan", "Push In", "FPV Drone", "Rack Focus"];
const VIDEO_MODELS = ["kling-3", "seedance-2-5", "veo-3-1", "wan-2-7", "grok-imagine"];
const PHOTO_MODELS = ["nano-banana-pro", "gpt-image-2", "seedream-5-pro", "flux-2-pro", "nano-banana-2"];

function Picker({ label, options, value, onPick }: { label: string; options: string[]; value: string | string[]; onPick: (v: string) => void }) {
  const on = (o: string) => (Array.isArray(value) ? value.includes(o) : value === o);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 px-1 text-xs font-semibold tracking-wide text-muted uppercase">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={on(o)} onClick={() => onPick(o)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${on(o) ? "bg-lime text-black" : "bg-chip text-fg/80 hover:bg-line"}`}>{o}</button>
        ))}
      </div>
    </fieldset>
  );
}

export default function CinemaStudio() {
  const [mode, setMode] = useState<"video" | "photo">("video");
  const [camera, setCamera] = useState(CAMERAS[0]);
  const [lens, setLens] = useState(LENSES[0]);
  const [focal, setFocal] = useState("35mm");
  const [aperture, setAperture] = useState(APERTURES[0]);
  const [moves, setMoves] = useState<string[]>(["Dolly In"]);
  const [modelId, setModelId] = useState("kling-3");
  const [aspect, setAspect] = useState("");
  const [res, setRes] = useState("");
  const [dur, setDur] = useState(0);
  const [start, setStart] = useState<string>();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const items = useHistory().filter((i) => i.prompt.includes("Shot on ") && i.kind === (mode === "video" ? "video" : "image"));

  const list = mode === "video" ? VIDEO_MODELS : PHOTO_MODELS;
  const model = byId(list.includes(modelId) ? modelId : list[0])!;
  const aspectV = model.aspects.includes(aspect) ? aspect : model.aspects.includes("16:9") ? "16:9" : model.aspects[0];
  const resolution = model.resolutions.includes(res) ? res : defaultRes(model);
  const duration = model.durations.includes(dur) ? dur : model.durations[0] ?? 0;
  const cost = estimateUsd(model, duration, resolution, true);
  const toggleMove = (m: string) => setMoves((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : ms.length < 3 ? [...ms, m] : ms));

  const fullPrompt = [
    prompt.trim(),
    `Shot on ${camera} with a ${lens} lens at ${focal}, ${aperture}.`,
    mode === "video" ? (moves.length ? `Camera movement: ${moves.join(", then ")}.` : "Locked-off static camera.") : "Single cinematic still frame.",
    "Cinematic lighting, film-grade color, professional cinematography.",
  ].filter(Boolean).join(" ");

  async function generate() {
    if (cost > 2 && !(await askToPay(cost))) return;
    setBusy(true); setError("");
    try {
      const params = { prompt: fullPrompt, duration, aspect: aspectV, resolution, audio: true, start };
      const d = await fetch("/api/generate", { method: "POST", body: JSON.stringify({ modelId: model.id, params }) }).then((r) => r.json());
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
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl bg-panel p-3 lg:w-[400px]">
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-black tracking-tight uppercase">Cinema Studio</h1>
          <div role="radiogroup" aria-label="Mode" className="flex rounded-lg bg-chip p-0.5 text-xs font-semibold">
            {(["video", "photo"] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 capitalize ${mode === m ? "bg-fg text-black" : "text-muted"}`}>{m === "video" ? "Videography" : "Photography"}</button>
            ))}
          </div>
        </div>

        <Picker label="Camera" options={CAMERAS} value={camera} onPick={setCamera} />
        <Picker label="Lens" options={LENSES} value={lens} onPick={setLens} />
        <Picker label="Focal length" options={FOCALS} value={focal} onPick={setFocal} />
        <Picker label="Aperture" options={APERTURES} value={aperture} onPick={setAperture} />
        {mode === "video" && <Picker label={`Camera moves (stack up to 3 · ${moves.length}/3)`} options={MOVES} value={moves} onPick={toggleMove} />}

        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Upload label="Reference" accept="image/*" value={start} onChange={(u) => setStart(u)} optional />
          <label className="flex flex-col gap-1 rounded-xl bg-chip p-3">
            <span className="text-xs font-semibold text-muted">Scene</span>
            <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A detective walks through a rain-soaked neon alley at night…"
              className="resize-none bg-transparent text-sm outline-none placeholder:text-muted/70" />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip label="Model" value={model.id} options={list} fmt={(id) => byId(id)!.name} onChange={setModelId} />
          {model.aspects.length > 1 && <Chip label="Aspect ratio" value={aspectV} options={model.aspects} onChange={setAspect} />}
          {model.resolutions.length > 1 && <Chip label={model.resLabel ?? "Quality"} value={resolution} options={model.resolutions} onChange={setRes} />}
          {model.durations.length > 1 && <Chip label="Duration" value={duration} options={model.durations} fmt={(d) => `${d}s`} onChange={(v) => setDur(Number(v))} />}
        </div>

        <details className="rounded-lg bg-chip px-3 py-2 text-xs text-muted">
          <summary className="cursor-pointer">Final prompt</summary>
          <p className="mt-1 text-fg/80">{fullPrompt}</p>
        </details>

        {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <div className="sticky bottom-0 -mx-3 -mb-3 mt-auto bg-panel p-3 pt-2">
          <button onClick={generate} disabled={busy || !prompt.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-bold text-black shadow-[0_0_24px_rgba(209,254,23,.25)] hover:brightness-110 disabled:opacity-40">
            {busy ? "Sending…" : mode === "video" ? "Shoot Video" : "Shoot Photo"} <span className="rounded-md bg-black/10 px-1.5 text-xs">✦ ≈${cost.toFixed(2)}</span>
          </button>
          {!prompt.trim() && <p className="mt-1 text-center text-[11px] text-muted">Add: Scene</p>}
        </div>
      </aside>
      <main className="min-h-[60vh] flex-1 overflow-y-auto rounded-2xl bg-panel/40 p-3">
        <Feed items={items} kind={mode === "video" ? "video" : "image"} />
      </main>
    </div>
  );
}
