"use client";
import { useState } from "react";
import { refreshHistory, removeItem, type Item } from "@/lib/history";
import Link from "next/link";
import { appById, stepsOf } from "@/lib/apps";

type Act = ((i: Item) => void) | undefined;
export default function Feed({ items, kind, onReuse, onContinue, onExtend }: { items: Item[]; kind: "video" | "image" | "audio"; onReuse?: Act; onContinue?: Act; onExtend?: Act }) {
  if (!items.length) return <HowItWorks kind={kind} />;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {items.map((i) => (
        <figure key={i.id} className="overflow-hidden rounded-xl bg-panel">
          <div className="relative grid aspect-video place-items-center bg-black">
            {i.state === "success" && i.kind === "text" ? (
              <div className="absolute inset-0 overflow-y-auto p-3 text-left text-[13px] leading-relaxed whitespace-pre-wrap text-fg/90">{i.text || "(no answer)"}</div>
            ) : i.state === "success" && i.url ? (
              i.kind === "audio" ? <audio src={i.url} controls className="w-11/12" />
              : i.kind === "video" ? <video src={i.url} controls loop playsInline className="size-full object-contain" />
                : <RetryImg src={i.url} alt={i.prompt} />
            ) : i.state === "pending" ? (
              <div className="flex flex-col items-center gap-2 text-sm text-muted">
                <span className="size-8 animate-spin rounded-full border-2 border-line border-t-lime" />
                Generating…{i.app && appById(i.app.id) && stepsOf(appById(i.app.id)!, i.app.input).length > 1 && ` step ${i.app.step + 1} of ${stepsOf(appById(i.app.id)!, i.app.input).length}`}
              </div>
            ) : (
              <p className="p-4 text-center text-sm text-red-300">{i.error}</p>
            )}
          </div>
          <figcaption className="flex flex-col gap-2 p-3 text-xs">
            <div className="flex items-start gap-2">
              <p className="line-clamp-2 flex-1 text-fg/80" title={i.prompt}>{i.prompt}</p>
              <CopyButton text={i.kind === "text" && i.text ? i.text : i.prompt} />
              {(i.params || i.app) && <RegenButton item={i} />}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-muted">
              <span className="rounded bg-chip px-1.5 py-0.5">{i.modelName}</span>
              {i.usd != null && <span className="rounded bg-chip px-1.5 py-0.5">${i.usd.toFixed(2)}</span>}
              <span>{new Date(i.createdAt).toLocaleString()}</span>
              <span className="ml-auto flex gap-1">
                {onReuse && <button onClick={() => onReuse(i)} className="rounded bg-chip px-2 py-1 hover:text-fg">Reuse</button>}
                {onContinue && i.lastFrame && <button onClick={() => onContinue(i)} title="Start a new clip from this clip's last frame" className="rounded bg-chip px-2 py-1 hover:text-fg">Continue →</button>}
                {onExtend && i.state === "success" && i.modelId.startsWith("grok") && <button onClick={() => onExtend(i)} title="Add 6-10s to this video" className="rounded bg-chip px-2 py-1 hover:text-fg">Extend +</button>}
                {i.group && i.group === i.id && <Link href={`/join?group=${i.group}`} className="rounded-md bg-lime px-2 py-1 font-semibold text-black hover:brightness-110">⧉ Join scenes</Link>}
                {i.group && i.group !== i.id && i.kind === "video" && (/ · Part \d/.test(i.modelName)
                  ? <Link href={`/join?group=${i.group}`} className="rounded-md bg-lime px-2 py-1 font-semibold text-black hover:brightness-110">⧉ Join both parts into one video</Link>
                  : <Link href={`/join?group=${i.group}`} className="rounded bg-chip px-2 py-1 hover:text-fg">⧉ Join</Link>)}
                {i.url && <DownloadButton item={i} />}
                {i.url && <DriveButton item={i} />}
                <button onClick={() => confirm("Delete this from history?") && removeItem(i.id)} aria-label="Delete" className="rounded bg-chip px-2 py-1 hover:text-red-300">✕</button>
              </span>
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function HowItWorks({ kind }: { kind: "video" | "image" | "audio" }) {
  const steps = kind === "audio"
    ? [["Pick a tool", "Voiceover, music or sound effects"], ["Describe it", "Type the words, or describe the sound or song"], ["Get audio", "Play, download or export to Drive"]]
    : kind === "video"
    ? [["Add image", "Upload a start frame — or just write a prompt"], ["Choose preset", "Pick a camera move or commercial look"], ["Get video", "Click generate to create your final video"]]
    : [["Describe", "Write what you want to see"], ["Add reference", "Optionally upload a product or style image"], ["Get image", "Click generate"]];
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-10">
      <h1 className="text-4xl font-black tracking-tight uppercase md:text-5xl">Make {kind}s in one click</h1>
      <p className="text-muted">Every top model in one workspace — pick a cheap model for drafts, a premium one for the final cut.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map(([t, d], n) => (
          <div key={t} className="rounded-2xl bg-panel p-5">
            <span className="text-sm font-bold text-lime">0{n + 1}</span>
            <h3 className="mt-6 font-black uppercase">{t}</h3>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Download = Higgsfield's pink gradient; Google Drive = solid dark blue.
const PINK = "text-white [background-image:radial-gradient(39.71%_136.54%_at_51.64%_117.31%,#F920D1_0%,#ED1572_100%)]";
const BLUE = "bg-[#1f3f99] text-white"; // solid dark blue (owner preference)
const ACTION = "rounded-md px-2 py-1 font-semibold transition hover:brightness-110 disabled:opacity-60";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button title="Copy prompt" aria-label="Copy prompt" className="shrink-0 rounded bg-chip px-2 py-1 hover:text-fg"
      onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? "✓ Copied" : "⧉ Copy"}
    </button>
  );
}

// Runs the exact same generation again (same model/app, settings and inputs).
function RegenButton({ item }: { item: Item }) {
  const [busy, setBusy] = useState(false);
  async function regen() {
    if ((item.usd ?? 0) > 2 && !confirm(`This cost $${item.usd!.toFixed(2)} last time. Run it again?`)) return;
    setBusy(true);
    const body = item.app ? { appId: item.app.id, input: item.app.input } : { modelId: item.modelId, params: item.params };
    const d = await fetch("/api/generate", { method: "POST", body: JSON.stringify(body) }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    setBusy(false);
    if (d.error) alert(d.error);
    else await refreshHistory();
  }
  return (
    <button onClick={regen} disabled={busy} title="Generate again with the same prompt and settings" className="shrink-0 rounded bg-chip px-2 py-1 hover:text-fg disabled:opacity-50">
      {busy ? "…" : "↻ Regenerate"}
    </button>
  );
}

// Saves the file itself (Kie's file host allows cross-origin fetches); falls back to opening it.
function DownloadButton({ item }: { item: Item }) {
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const blob = await fetch(item.url!).then((r) => { if (!r.ok) throw new Error(); return r.blob(); });
      const ext = item.url!.match(/\.(\w{3,4})(\?|$)/)?.[1] ?? (item.kind === "video" ? "mp4" : item.kind === "audio" ? "mp3" : "jpg");
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `higgsview-${item.modelId}-${item.id.slice(0, 6)}.${ext}` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch {
      window.open(item.url, "_blank");
    } finally {
      setBusy(false);
    }
  }
  return <button onClick={save} disabled={busy} className={`${ACTION} ${PINK}`}>{busy ? "Saving…" : "↓ Download"}</button>;
}

// Free providers render on request and can time out the first load; remount to retry.
function RetryImg({ src, alt }: { src: string; alt: string }) {
  const [tries, setTries] = useState(0);
  return <img key={tries} src={src} alt={alt} className="size-full object-contain"
    onError={() => tries < 5 && setTimeout(() => setTries(tries + 1), 4000)} />;
}

function DriveButton({ item }: { item: Item }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  if (item.driveLink)
    return <a href={item.driveLink} target="_blank" rel="noreferrer" className={`${ACTION} ${BLUE}`}>✓ In Drive</a>;
  async function exportIt() {
    setState("busy");
    const d = await fetch("/api/export", { method: "POST", body: JSON.stringify({ id: item.id }) }).then((r) => r.json()).catch(() => ({}));
    if (d.link) await refreshHistory();
    else setState("error");
  }
  return (
    <button onClick={exportIt} disabled={state === "busy"} title="Save to Google Drive → My Drive/Higgsview"
      className={`${ACTION} ${state === "error" ? "bg-red-500/20 text-red-300" : BLUE}`}>
      {state === "busy" ? "Saving…" : state === "error" ? "Retry Drive" : "▲ Google Drive"}
    </button>
  );
}
