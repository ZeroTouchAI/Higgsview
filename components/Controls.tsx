"use client";
import { useRef, useState } from "react";

// Uploads straight from the browser to our Blob store via a presigned URL (any size), then returns a URL Kie can read.
export function Upload({ label, accept, value, onChange, optional, maxPixels, compact }: {
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
        {value ? (accept.startsWith("audio") ? <span className="px-2 text-lime">♪ Audio added</span> : accept.startsWith("video") ? <video src={value} muted className="absolute inset-0 size-full object-cover" /> : <img src={value} alt={label} className="absolute inset-0 size-full object-cover" />)
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

export function Chip<T extends string | number>({ label, value, options, onChange, fmt = String }: { label: string; value: T; options: T[]; onChange: (v: string) => void; fmt?: (v: T) => string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer appearance-none rounded-lg bg-chip px-3 py-1.5 text-sm font-medium outline-none hover:bg-line focus:ring-2 focus:ring-lime">
      {options.map((o) => <option key={o} value={o}>{fmt(o)}</option>)}
    </select>
  );
}

