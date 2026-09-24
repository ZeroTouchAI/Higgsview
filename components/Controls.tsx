"use client";
import { useRef, useState } from "react";

// Uploads straight from the browser to our Blob store via a presigned URL (any size), then returns a URL Kie can read.
export function Upload({ label, accept, value, onChange, optional, maxPixels, maxSecs, compact }: {
  label: string; accept: string; value?: string; onChange: (url?: string, seconds?: number) => void;
  optional?: boolean; maxPixels?: number; maxSecs?: number; compact?: boolean;
}) {
  const [status, setStatus] = useState(""); // non-empty while converting/uploading
  const [err, setErr] = useState("");
  const [note, setNote] = useState(""); // e.g. "Trimmed to 30s"
  const input = useRef<HTMLInputElement>(null);
  async function pick(f?: File) {
    if (!f) return;
    setErr(""); setNote("");
    let seconds: number | undefined;
    setStatus("Reading…");
    try {
      if (f.type.startsWith("video/")) {
        const meta = await videoMeta(f);
        seconds = meta?.seconds;
        // Fix the video here instead of making you re-export: shrink to ~720p for pixel-limited models
        // (Seedance: 409,600–927,408 px) and cut anything past the model's max length.
        const px = meta ? meta.w * meta.h : 0;
        const badPx = !!maxPixels && !!meta && (px > maxPixels || px < 409600);
        const tooLong = !!maxSecs && !!meta && meta.seconds > maxSecs;
        if (meta && (badPx || tooLong)) {
          const k = badPx ? Math.sqrt(921600 / px) : Math.min(1, 1920 / Math.max(meta.w, meta.h));
          const w = Math.round((meta.w * k) / 2) * 2, h = Math.round((meta.h * k) / 2) * 2;
          const secs = Math.min(meta.seconds, maxSecs ? maxSecs - 0.5 : Infinity); // margin: the stop timer can run a little late
          f = await resizeVideo(f, w, h, secs, (p) => setStatus(`${tooLong ? `Trimming to ${maxSecs}s` : `Converting to ${w}×${h}`}… ${p}%`));
          seconds = secs;
          setNote([tooLong && `Trimmed to first ${maxSecs}s`, badPx && `resized to ${w}×${h}`].filter(Boolean).join(", "));
        }
      }
      // Some models (e.g. Kling Avatar) only take JPG/PNG: convert WebP/AVIF/GIF etc. to JPG first.
      if (f.type.startsWith("image/") && !/^image\/(jpeg|png)$/.test(f.type)) f = await toJpeg(f);
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
      {value && note && <span className="absolute inset-x-1 bottom-1 rounded bg-black/75 px-1 py-0.5 text-[10px] text-lime">{note}</span>}
      {value && <button onClick={() => onChange(undefined)} aria-label={`Remove ${label}`} className="absolute top-1 right-1 rounded-md bg-black/70 px-1.5">✕</button>}
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

async function toJpeg(f: File): Promise<File> {
  const bmp = await createImageBitmap(f);
  const c = Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  const blob = await new Promise<Blob>((r, x) => c.toBlob((b) => (b ? r(b) : x(new Error("Image conversion failed"))), "image/jpeg", 0.92));
  return new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
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
  const finish = () => { if (rec.state === "recording") { v.pause(); rec.stop(); } };
  // Frames are drawn on every decoded video frame; the stop check runs on a timer too, because
  // frame callbacks pause when the tab is hidden and the clip would run past the limit.
  const draw = () => { ctx.drawImage(v, 0, 0, w, h); if (rec.state === "recording") v.requestVideoFrameCallback(draw); };
  const tick = setInterval(() => {
    if (document.hidden) ctx.drawImage(v, 0, 0, w, h); // keep frames coming if you switch tabs mid-conversion
    progress(Math.min(99, Math.round((v.currentTime / end) * 100)));
    if (v.currentTime >= end) finish();
  }, 50);
  v.onended = finish;
  rec.start(1000);
  await v.play();
  v.requestVideoFrameCallback(draw);
  await done;
  clearInterval(tick);
  audio.close();
  URL.revokeObjectURL(v.src);
  return new File(chunks, f.name.replace(/\.\w+$/, "") + "-720p.mp4", { type: "video/mp4" });
}

function videoMeta(f: File): Promise<{ w: number; h: number; seconds: number } | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve({ w: v.videoWidth, h: v.videoHeight, seconds: v.duration }); URL.revokeObjectURL(v.src); };
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

