"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { refreshHistory, useHistory, type Item } from "@/lib/history";
import { recordClips } from "@/components/Controls";
import { driveToken, saveToDrive } from "@/lib/google";
import { kieBlob } from "@/lib/kieFile";
import { tell } from "@/components/Dialog";

// Add text: puts the exact brand name / tagline / URL (and optionally a logo) on top of a finished video.
// AI video models can't spell reliably, so the text is drawn by Higgsview itself. The preview uses the same
// drawing code as the final render, and the result goes to the user's Google Drive (like Join).
type Opts = { title: string; sub: string; color: string; pos: "top" | "center" | "bottom"; when: "all" | "end"; endSecs: number };
const COLORS = ["#ffffff", "#0b0b0b", "#d1fe17", "#F920D1", "#22D3EE"];
const stamp = () => ({ id: crypto.randomUUID(), createdAt: Date.now() }); // outside the component (purity lint)
const local = async (u: string) => URL.createObjectURL(await kieBlob(u));

function paint(ctx: CanvasRenderingContext2D, t: number, total: number, o: Opts, logo?: HTMLImageElement) {
  const { width: w, height: h } = ctx.canvas;
  const from = o.when === "end" ? Math.max(0, total - o.endSecs) : 0;
  if (t < from) return;
  const a = o.when === "end" ? Math.min(1, (t - from) / 0.4) : 1; // end card fades in
  ctx.save();
  ctx.globalAlpha = a;
  if (o.when === "end") { ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.fillRect(0, 0, w, h); } // covers any garbled AI text underneath
  const unit = Math.min(w, h);
  const size = Math.round(unit * (o.title.length > 14 ? 0.075 : 0.1));
  const logoH = logo ? Math.round(unit * 0.16) : 0;
  const block = logoH + (logo ? unit * 0.03 : 0) + size + (o.sub ? size * 0.9 : 0);
  const pos = o.when === "end" ? "center" : o.pos;
  let y = pos === "top" ? h * 0.08 : pos === "bottom" ? h * 0.92 - block : (h - block) / 2;
  if (logo) {
    const lw = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, (w - lw) / 2, y, lw, logoH);
    y += logoH + unit * 0.03;
  }
  const font = getComputedStyle(document.body).fontFamily;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = o.color;
  ctx.shadowColor = o.color === "#0b0b0b" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)";
  ctx.shadowBlur = size * 0.25;
  if (o.title) { ctx.font = `900 ${size}px ${font}`; ctx.fillText(o.title, w / 2, y, w * 0.9); y += size * 1.15; }
  if (o.sub) { ctx.font = `600 ${Math.round(size * 0.45)}px ${font}`; ctx.fillText(o.sub, w / 2, y, w * 0.9); }
  ctx.restore();
}

export default function BrandPage() {
  return <Suspense><Brand /></Suspense>;
}

function Brand() {
  const sp = useSearchParams();
  const router = useRouter();
  const item = useHistory().find((i) => i.id === sp.get("id"));
  const [o, setO] = useState<Opts>({ title: "", sub: "", color: "#ffffff", pos: "bottom", when: "end", endSecs: 3 });
  const [logo, setLogo] = useState<HTMLImageElement>();
  const [src, setSrc] = useState<string>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // A local copy of the clip (the History card's copy is cached without CORS, which blocks canvas drawing).
  useEffect(() => { if (item?.url) local(item.url).then(setSrc, (e) => setError(e.message)); }, [item?.url]);

  // Live preview: the video drawn to a canvas with the overlay on top, every frame.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const v = video.current, c = canvas.current;
      if (v && c && v.videoWidth) {
        const k = 720 / Math.max(v.videoWidth, v.videoHeight);
        c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
        const ctx = c.getContext("2d")!;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        paint(ctx, v.currentTime, v.duration || 0, o, logo);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [o, logo]);

  function pickLogo(f?: File) {
    if (!f) return;
    const img = new Image();
    img.onload = () => setLogo(img);
    img.src = URL.createObjectURL(f);
  }

  async function render() {
    setError("");
    try {
      setStatus("Connecting Google Drive…");
      await driveToken(); // ask now, while the click still counts (Google blocks the popup later)
      const v = video.current!;
      const k = 1280 / Math.max(v.videoWidth, v.videoHeight);
      const even = (n: number) => Math.round((n * k) / 2) * 2;
      const blob = await recordClips([{ src: src! }], even(v.videoWidth), even(v.videoHeight),
        (p) => setStatus(`Adding text… ${p}% (plays in real time — keep this tab open)`), undefined, (ctx, t, total) => paint(ctx, t, total, o, logo));
      setStatus("Saving to your Google Drive…");
      const { id, createdAt } = stamp();
      const name = `higgsview-branded-${new Date(createdAt).toISOString().slice(0, 19).replace(/:/g, "-")}.mp4`;
      const saved = await saveToDrive(blob, name).catch(async (e: Error) => {
        const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
        a.click();
        await tell("Saved to your computer instead", `Couldn't save to Google Drive (${e.message}), so the video was downloaded to your computer.`);
        return undefined;
      });
      if (!saved) { setStatus(""); return; }
      const out: Item = {
        id, kind: "video", modelId: "brand", modelName: "Video + text", prompt: `“${o.title}”${o.sub ? ` · ${o.sub}` : ""} on: ${item!.prompt.slice(0, 120)}`,
        driveLink: saved.link, driveFolder: { link: saved.folder, name: saved.folderName }, state: "success", usd: 0, createdAt,
      };
      await fetch("/api/history", { method: "POST", body: JSON.stringify([out]) });
      await refreshHistory();
      router.push("/history");
    } catch (e) {
      setError((e as Error).message);
      setStatus("");
    }
  }

  const field = "rounded-xl bg-chip px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-lime";
  const chip = (on: boolean) => `rounded-lg px-3 py-1.5 text-xs font-bold ${on ? "bg-lime text-black" : "bg-chip hover:bg-line"}`;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-3 rounded-2xl bg-panel p-4 lg:w-[360px]">
        <header>
          <h1 className="text-2xl font-black uppercase">Add text</h1>
          <p className="text-xs text-muted">Your exact brand name, tagline or URL on top of the video. Drawn by Higgsview, so it&apos;s always spelled right.</p>
        </header>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Brand name / title
          <input className={field} value={o.title} onChange={(e) => setO({ ...o, title: e.target.value })} placeholder="HIGGSVIEW" maxLength={40} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Second line (optional)
          <input className={field} value={o.sub} onChange={(e) => setO({ ...o, sub: e.target.value })} placeholder="higgsview.vercel.app" maxLength={60} />
        </label>
        <div className="flex flex-col gap-1.5 text-xs font-semibold text-muted">Show it
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setO({ ...o, when: "end" })} className={chip(o.when === "end")}>End card</button>
            <button onClick={() => setO({ ...o, when: "all" })} className={chip(o.when === "all")}>Whole video</button>
            {o.when === "end" && [2, 3, 5].map((n) => <button key={n} onClick={() => setO({ ...o, endSecs: n })} className={chip(o.endSecs === n)}>last {n}s</button>)}
          </div>
        </div>
        {o.when === "all" && (
          <div className="flex flex-col gap-1.5 text-xs font-semibold text-muted">Position
            <div className="flex gap-1.5">{(["top", "center", "bottom"] as const).map((p) => <button key={p} onClick={() => setO({ ...o, pos: p })} className={chip(o.pos === p)}>{p}</button>)}</div>
          </div>
        )}
        <div className="flex flex-col gap-1.5 text-xs font-semibold text-muted">Color
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => <button key={c} onClick={() => setO({ ...o, color: c })} aria-label={`Color ${c}`} className={`size-7 rounded-full border-2 ${o.color === c ? "border-lime" : "border-white/20"}`} style={{ background: c }} />)}
            <input type="color" value={o.color} onChange={(e) => setO({ ...o, color: e.target.value })} aria-label="Custom color" className="size-7 cursor-pointer rounded-full bg-transparent" />
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Logo (optional, PNG with a transparent background looks best)
          <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(e) => pickLogo(e.target.files?.[0])} className="text-xs" />
        </label>
        {logo && <button onClick={() => setLogo(undefined)} className="w-fit text-xs text-muted underline">Remove logo</button>}
        <button onClick={render} disabled={!src || !!status || (!o.title && !o.sub && !logo)}
          className="rounded-xl bg-lime py-3 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40">{status ? "Working…" : "Make video with text → Google Drive"}</button>
        {status && <p role="status" className="text-xs text-lime">{status}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
      </aside>
      <main className="grid flex-1 place-items-center rounded-2xl bg-black p-3">
        {!item ? <p className="text-sm text-muted">Pick a video in History and press “✎ Add text”.</p> : (
          <div className="flex w-full flex-col items-center gap-2">
            <canvas ref={canvas} className="max-h-[70vh] max-w-full rounded-xl" />
            <video ref={video} src={src} controls loop playsInline className="h-12 w-full max-w-md" /> {/* player controls; the canvas above shows the picture */}
            <p className="text-xs text-muted">Play the video to preview. The end card appears in the last seconds.</p>
          </div>
        )}
      </main>
    </div>
  );
}
