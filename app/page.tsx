"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { MODELS, estimateUsd } from "@/lib/models";

export default function Explore() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("seedance-2-fast");
  const video = MODELS.filter((m) => m.mode === "create");
  const go = () => router.push(`/video?model=${model}&prompt=${encodeURIComponent(prompt)}`);

  return (
    <div className="flex flex-col gap-10 p-4">
      <section className="relative grid min-h-[520px] place-items-center overflow-hidden rounded-3xl bg-[radial-gradient(ellipse_at_top,#2b3a10,transparent_60%),linear-gradient(180deg,#141414,#0b0b0b)] px-4 text-center">
        <div className="flex max-w-3xl flex-col items-center gap-5">
          <h1 className="text-5xl leading-[0.95] font-black tracking-tight uppercase md:text-7xl">AI video generator.<br />Studio-grade results.</h1>
          <p className="text-fg/80">From prompt to cinematic commercial in minutes. Every top model, one workspace — at raw API prices.</p>
          <div className="mt-4 flex w-full flex-col gap-3 rounded-2xl border border-line bg-black/60 p-3 text-left backdrop-blur sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-3">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} aria-label="Prompt"
                placeholder="Describe any visual idea. We will generate a video."
                className="resize-none bg-transparent text-sm outline-none placeholder:text-muted" />
              <select value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model"
                className="w-fit rounded-lg bg-chip px-3 py-1.5 text-sm font-semibold outline-none">
                {video.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <button onClick={go} className="rounded-xl bg-lime px-8 py-6 text-xs font-bold text-black uppercase shadow-[0_0_30px_rgba(209,254,23,.35)] hover:brightness-110">Generate</button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-3xl font-black tracking-tight uppercase">One studio. Every AI video model.</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {video.map((m, i) => (
            <div key={m.id} className="flex flex-col gap-3 rounded-2xl bg-panel p-4">
              <div className="aspect-video rounded-xl" style={{ background: `linear-gradient(135deg, hsl(${(i * 53) % 360} 40% 20%), #0e0e0e)` }} />
              <div className="flex items-center gap-2">
                <h3 className="font-bold">{m.name}</h3>
                {m.badge && <span className="rounded bg-lime px-1 text-[10px] font-black text-black italic">{m.badge}</span>}
                <span className="ml-auto text-xs text-muted">from ≈${estimateUsd(m, m.durations[0], m.resolutions[0]).toFixed(2)}/{m.durations[0]}s</span>
              </div>
              <p className="flex-1 text-sm text-muted">{m.desc}</p>
              <Link href={`/video?model=${m.id}`} className="rounded-xl bg-chip py-2 text-center text-sm font-semibold hover:bg-line">Generate</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
