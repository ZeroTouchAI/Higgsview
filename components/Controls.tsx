"use client";
import { useRef, useState } from "react";

// Uploads straight from the browser to our Blob store via a presigned URL (any size), then returns a URL Kie can read.
// File types the models accept (images other than JPG/PNG are converted to JPG before upload).
const TYPES: Record<string, [RegExp, string, string]> = {
  image: [/^image\/(jpeg|png|webp|gif|avif|bmp)$/, ".jpg,.jpeg,.png,.webp,.gif,.avif,.bmp", "JPG, PNG, WebP or GIF"],
  video: [/^video\/(mp4|quicktime|webm)$/, ".mp4,.mov,.webm", "MP4, MOV or WebM"],
  audio: [/^audio\/(mpeg|mp3|wav|x-wav|wave|mp4|x-m4a|m4a|aac)$/, ".mp3,.wav,.m4a,.aac", "MP3, WAV, M4A or AAC"],
};

export function Upload({ label, accept, value, onChange, optional, maxPixels, maxSecs, minSide, split, compact }: {
  label: string; accept: string; value?: string; onChange: (url?: string, seconds?: number, part2?: string, ratio?: number) => void; // ratio = video width / height
  optional?: boolean; maxPixels?: number; maxSecs?: number; minSide?: number; compact?: boolean;
  split?: boolean; // videos longer than maxSecs become 2 parts (up to 2× maxSecs) instead of being trimmed
}) {
  const [status, setStatus] = useState(""); // non-empty while converting/uploading
  const [err, setErr] = useState("");
  const [note, setNote] = useState(""); // e.g. "Trimmed to 30s"
  const input = useRef<HTMLInputElement>(null);
  async function pick(f?: File) {
    if (!f) return;
    setErr(""); setNote("");
    const [ok, , names] = TYPES[accept.split("/")[0]];
    if (!ok.test(f.type)) return setErr(`Unsupported file. Use ${names}.`);
    let seconds: number | undefined, ratio: number | undefined;
    setStatus("Reading…");
    try {
      if (f.type.startsWith("video/")) {
        const meta = await videoMeta(f);
        seconds = meta?.seconds;
        if (meta) ratio = meta.w / meta.h;
        // Fix the video here instead of making you re-export: shrink to ~720p for pixel-limited models
        // (Seedance: 409,600–927,408 px) and cut anything past the model's max length.
        const px = meta ? meta.w * meta.h : 0;
        const badPx = !!maxPixels && !!meta && (px > maxPixels || px < 409600);
        const tooLong = !!maxSecs && !!meta && meta.seconds > maxSecs - 0.5; // Kie measures length its own way (audio can run long): keep a margin
        const tooSmall = !!minSide && !!meta && Math.min(meta.w, meta.h) < minSide;
        // Seedance/Kling-Omni models: always re-encode (fps must be 24–60, odd phone formats get normalized).
        if (meta && (badPx || tooLong || tooSmall || !!maxPixels || !!minSide)) {
          const k = badPx ? Math.sqrt(921600 / px) : tooSmall ? minSide! / Math.min(meta.w, meta.h) : Math.min(1, 1920 / Math.max(meta.w, meta.h));
          const w = Math.round((meta.w * k) / 2) * 2, h = Math.round((meta.h * k) / 2) * 2;
          const secs = Math.min(meta.seconds, maxSecs ? maxSecs - 0.5 : Infinity); // margin: the stop timer can run a little late
          if (split && tooLong) {
            // Long video: two parts of up to maxSecs each, generated separately and joined afterwards.
            // Two equal halves (a 17s video → 2 × 8.5s, not 14.5s + a 2.5s part Kie rejects), each at most maxSecs − 0.5.
            const len = Math.min(maxSecs! - 0.5, meta.seconds / 2), rest = len;
            const [a, b] = [await resizeVideo(f, w, h, len, (p) => setStatus(`Preparing part 1… ${p}%`)), await resizeVideo(f, w, h, rest, (p) => setStatus(`Preparing part 2… ${p}%`), len)];
            const [ua, ub] = [await uploadFile(a), await uploadFile(b)];
            onChange(ua, len + rest, ub, meta.w / meta.h);
            setNote(`Split into 2 parts (${Math.round(len + rest)}s total)`);
            return;
          }
          f = await resizeVideo(f, w, h, secs, (p) => setStatus(`${tooLong ? `Trimming to ${maxSecs}s` : `Preparing video`}… ${p}% (keep this tab open)`));
          seconds = secs;
          setNote([tooLong && `Trimmed to first ${maxSecs}s`, (badPx || tooSmall) && `resized to ${w}×${h}`, "30 fps"].filter(Boolean).join(", "));
        }
      }
      // Some models (e.g. Kling Avatar) only take JPG/PNG: convert WebP/AVIF/GIF etc. to JPG first.
      if (f.type.startsWith("image/") && !/^image\/(jpeg|png)$/.test(f.type)) f = await toJpeg(f);
      setStatus("Uploading…");
      onChange(await uploadFile(f), seconds, undefined, ratio);
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
      <input ref={input} type="file" accept={TYPES[accept.split("/")[0]][1]} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

// Browser → private Blob store (presigned PUT). Returns a 24h URL that Kie can read.
// Last frame of a video as a JPG (fresh fetch: a copy cached without CORS would taint the canvas).
export async function lastFrame(url: string): Promise<File> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("Couldn't load the finished part");
  const v = Object.assign(document.createElement("video"), { muted: true, preload: "auto", src: URL.createObjectURL(await r.blob()) });
  await new Promise((ok, fail) => { v.onloadedmetadata = ok; v.onerror = fail; });
  v.currentTime = Math.max(0, v.duration - 0.2);
  await new Promise((ok) => (v.onseeked = ok));
  const c = Object.assign(document.createElement("canvas"), { width: v.videoWidth, height: v.videoHeight });
  c.getContext("2d")!.drawImage(v, 0, 0);
  const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), "image/jpeg", 0.92));
  return new File([blob], `frame-${Date.now()}.jpg`, { type: "image/jpeg" });
}

export async function uploadFile(f: File | Blob, name = (f as File).name ?? "file"): Promise<string> {
  const d = await fetch("/api/upload", { method: "POST", body: JSON.stringify({ name, type: f.type, size: f.size }) }).then((r) => r.json());
  if (d.error) throw new Error(d.error);
  const put = await fetch(d.putUrl, { method: "PUT", body: f, headers: { "Content-Type": f.type } });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return d.getUrl;
}

async function toJpeg(f: File): Promise<File> {
  const bmp = await createImageBitmap(f);
  const c = Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  const blob = await new Promise<Blob>((r, x) => c.toBlob((b) => (b ? r(b) : x(new Error("Image conversion failed"))), "image/jpeg", 0.92));
  return new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

// Re-encode video in the browser (canvas + MediaRecorder, native in Chrome/Edge): plays each clip (optionally a
// start–end slice) into one w×h MP4 at a steady 30 fps, keeping audio, plus an optional soundtrack mixed in.
// Used to resize/trim uploads, split long videos and join clips.
// ponytail: plays in real time (a 30s result takes ~30s) and needs MP4 MediaRecorder (Chrome/Edge); ffmpeg.wasm if other browsers matter.
export async function recordClips(clips: { src: string; start?: number; end?: number }[], w: number, h: number, progress: (pct: number) => void, soundtrack?: string,
  overlay?: (ctx: CanvasRenderingContext2D, t: number, total: number) => void): Promise<Blob> { // overlay: drawn on every frame (t = seconds into the result)
  const mimeType = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) throw new Error("This browser can't convert video. Use Chrome or Edge.");
  // Load every clip first so there are no pauses between them.
  const vids = await Promise.all(clips.map(async (c) => {
    const v = Object.assign(document.createElement("video"), { crossOrigin: "anonymous", playsInline: true, preload: "auto", src: c.src });
    await new Promise((ok, fail) => { v.onloadeddata = ok; v.onerror = () => fail(new Error("Couldn't load a clip")); });
    const start = c.start ?? 0;
    if (start) { v.currentTime = start; await new Promise((r) => (v.onseeked = r)); }
    return { v, start, end: Math.min(v.duration, c.end ?? Infinity) };
  }));
  const total = vids.reduce((t, c) => t + (c.end - c.start), 0);
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = canvas.getContext("2d")!;
  // Frames are pushed manually at a steady 30 fps (Kie models need 24–60 fps; screen-repaint timing is uneven).
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  // Route audio into the recording without playing it out loud.
  const audio = new AudioContext();
  const dest = audio.createMediaStreamDestination();
  vids.forEach(({ v }) => audio.createMediaElementSource(v).connect(dest));
  let music: HTMLAudioElement | undefined;
  if (soundtrack) {
    music = Object.assign(new Audio(), { crossOrigin: "anonymous", src: soundtrack });
    await new Promise((ok, fail) => { music!.oncanplay = ok; music!.onerror = () => fail(new Error("Couldn't load the soundtrack")); });
    audio.createMediaElementSource(music).connect(dest);
  }
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  let k = 0, before = 0; // current clip, seconds recorded before it
  // Recording runs on the wall clock: whenever playback stops (buffering, or Chrome pausing video in a background
  // tab), pause the recorder too, or the frozen frames make the file longer than the content (Kie then rejects it).
  vids.forEach(({ v }) => {
    v.onwaiting = v.onpause = () => rec.state === "recording" && rec.pause();
    v.onplaying = () => rec.state === "paused" && rec.resume();
  });
  const wake = () => { if (!document.hidden && rec.state === "paused" && vids[k]?.v.paused) vids[k].v.play(); };
  document.addEventListener("visibilitychange", wake);
  const draw = (v: HTMLVideoElement) => { // letterbox: fit the clip inside the frame
    const s = Math.min(w / v.videoWidth, h / v.videoHeight), dw = v.videoWidth * s, dh = v.videoHeight * s;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); ctx.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh);
  };
  // Clock runs in a Worker: page timers get throttled to 1/s in background tabs, worker timers don't.
  const clock = new Worker(URL.createObjectURL(new Blob(["setInterval(() => postMessage(0), 1000 / 30)"], { type: "text/javascript" })));
  clock.onmessage = () => {
    if (rec.state === "inactive") return;
    const c = vids[k];
    if (rec.state === "recording") {
      draw(c.v);
      overlay?.(ctx, before + c.v.currentTime - c.start, total);
      track.requestFrame();
      progress(Math.min(99, Math.round(((before + c.v.currentTime - c.start) / total) * 100)));
    }
    if (c.v.currentTime >= c.end || c.v.ended) { // checked even while paused: a clip that ends fires "pause" first
      c.v.pause();
      before += c.end - c.start;
      if (++k < vids.length) vids[k].v.play(); else { music?.pause(); rec.stop(); }
    }
  };
  rec.start(1000);
  music?.play();
  await vids[0].v.play();
  await done;
  document.removeEventListener("visibilitychange", wake);
  clock.terminate();
  audio.close();
  return new Blob(chunks, { type: "video/mp4" });
}

async function resizeVideo(f: File, w: number, h: number, maxSecs: number, progress: (pct: number) => void, start = 0): Promise<File> {
  const src = URL.createObjectURL(f);
  try {
    const blob = await recordClips([{ src, start, end: start + maxSecs }], w, h, progress);
    // Safety net: the recorded file must not run longer than the slice (models reject e.g. >15.5s).
    if (await blobSeconds(blob) > maxSecs + 0.45) throw new Error("The video didn't convert cleanly (keep this tab open and in front while it prepares). Please try again.");
    return new File([blob], f.name.replace(/\.\w+$/, "") + (start ? `-part2` : "") + "-720p.mp4", { type: "video/mp4" });
  } finally {
    URL.revokeObjectURL(src);
  }
}

// Real length of a recorded MP4 (MediaRecorder files have no duration header: seek to the end to find it).
async function blobSeconds(b: Blob) {
  const v = Object.assign(document.createElement("video"), { muted: true, preload: "auto", src: URL.createObjectURL(b) });
  try {
    await new Promise((ok, fail) => { v.onloadedmetadata = ok; v.onerror = fail; });
    if (Number.isFinite(v.duration)) return v.duration;
    v.currentTime = 1e6;
    await new Promise((ok) => (v.onseeked = ok));
    return v.duration;
  } finally {
    URL.revokeObjectURL(v.src);
  }
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

