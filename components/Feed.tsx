"use client";
import { ask, askToPay, tell } from "@/components/Dialog";
import { useEffect, useState } from "react";
import { lastFrame, uploadFile } from "@/components/Controls";
import { loadGoogle, saveToDrive, savedFolder } from "@/lib/google";
import { refreshHistory, removeItem, type Item } from "@/lib/history";
import Link from "next/link";
import { appById, appCost, stepsOf } from "@/lib/apps";
import { byId, estimateUsd } from "@/lib/models";

type Act = ((i: Item) => void) | undefined;
// Split videos: when a part finishes, grab its last frame and start the next part with it (once per tab;
// the server makes sure only one tab wins).
const continued = new Set<string>();
async function continuePart(i: Item) {
  let frame = "";
  try { frame = await uploadFile(await lastFrame(i.url!)); } catch {} // no frame: the next part still runs, just without it
  await fetch("/api/generate", { method: "POST", body: JSON.stringify({ continueFrom: i.id, frame }) });
  await refreshHistory();
}

export default function Feed({ items, kind, onReuse, onContinue, onExtend }: { items: Item[]; kind: "video" | "image" | "audio"; onReuse?: Act; onContinue?: Act; onExtend?: Act }) {
  useEffect(() => {
    for (const i of items) if (i.next && i.state === "success" && i.url && !continued.has(i.id)) { continued.add(i.id); continuePart(i); }
  }, [items]);
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
                {i.next && <span className="px-4 text-center text-xs">{i.next.label.replace("/", " of ")} starts after this one, using its last frame so faces match. Keep Higgsview open.</span>}
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
                {onReuse && <button onClick={() => onReuse(i)} title="Load this prompt and model back into the panel so you can tweak it before generating again" className="rounded bg-chip px-2 py-1 hover:text-fg">Reuse</button>}
                {onContinue && i.lastFrame && <button onClick={() => onContinue(i)} title="Start a new clip from this clip's last frame" className="rounded bg-chip px-2 py-1 hover:text-fg">Continue →</button>}
                {onExtend && i.state === "success" && i.modelId.startsWith("grok") && <button onClick={() => onExtend(i)} title="Add 6-10s to this video" className="rounded bg-chip px-2 py-1 hover:text-fg">Extend +</button>}
                {i.group && i.group === i.id && <Link href={`/join?group=${i.group}`} className="rounded-md bg-lime px-2 py-1 font-semibold text-black hover:brightness-110">⧉ Join scenes</Link>}
                {i.group && i.group !== i.id && i.kind === "video" && (/ · Part \d/.test(i.modelName)
                  ? <Link href={`/join?group=${i.group}`} className="rounded-md bg-lime px-2 py-1 font-semibold text-black hover:brightness-110">⧉ Join both parts into one video</Link>
                  : <Link href={`/join?group=${i.group}`} className="rounded bg-chip px-2 py-1 hover:text-fg">⧉ Join</Link>)}
                {i.url && <DownloadButton item={i} />}
                {i.url && <DriveButton item={i} />}
                <button onClick={async () => (await ask({ title: "Delete from History?", message: "It disappears from your History. Its cost still counts on the Spending page.", confirm: "Delete", tone: "danger" })) && removeItem(i.id)} aria-label="Delete" className="rounded bg-chip px-2 py-1 hover:text-red-300">✕</button>
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
const GOLD = "bg-[linear-gradient(180deg,#F6A43C_0%,#D97A1E_100%)] text-black"; // orange-gold: Regenerate costs money
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
// What running it again will cost: the real charge from last time if there was one, else the estimate.
function regenCost(item: Item) {
  if (item.usd) return item.usd;
  const app = item.app && appById(item.app.id);
  if (app) return appCost(app, item.app!.input);
  const m = byId(item.modelId);
  const p = item.params;
  return m && p ? estimateUsd(m, p.duration > 0 ? p.duration : 10, p.resolution, p.audio) : 0;
}

function RegenButton({ item }: { item: Item }) {
  const [busy, setBusy] = useState(false);
  const cost = regenCost(item);
  async function regen() {
    // Regenerating is a new paid job: always say what it costs and ask first (free jobs skip the question).
    if (cost > 0 && !(await askToPay(cost, "Regenerating this"))) return;
    setBusy(true);
    const body = item.app ? { appId: item.app.id, input: item.app.input } : { modelId: item.modelId, params: item.params };
    const d = await fetch("/api/generate", { method: "POST", body: JSON.stringify(body) }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    setBusy(false);
    if (d.error) await tell("Couldn't regenerate", d.error);
    else await refreshHistory();
  }
  return (
    <button onClick={regen} disabled={busy} title={`Generate again with the same prompt and settings (≈$${cost.toFixed(2)}, asks before charging)`}
      className={`shrink-0 ${ACTION} ${GOLD}`}>
      {busy ? "…" : `↻ Regenerate${cost > 0 ? ` · $${cost.toFixed(2)}` : ""}`}
    </button>
  );
}

// Saves the file itself (Kie's file host allows cross-origin fetches); falls back to opening it.
function DownloadButton({ item }: { item: Item }) {
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const blob = await fetch(item.url!, { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(); return r.blob(); });
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
  const [err, setErr] = useState("");
  useEffect(() => { loadGoogle().catch(() => {}); }, []); // loaded before the click, so Google's popup isn't blocked
  if (item.driveLink)
    return (
      <span className="flex gap-1">
        <a href={item.driveLink} target="_blank" rel="noreferrer" title="Open the saved file in Google Drive" className={`${ACTION} ${BLUE}`}>↗ Open in Drive</a>
        {item.driveFolder && <a href={item.driveFolder.link} target="_blank" rel="noreferrer" title={`Saved in ${item.driveFolder.name}: open the folder`} className={`${ACTION} ${BLUE}`}>📁</a>}
      </span>
    );
  async function exportIt() {
    setState("busy");
    try {
      const ext = item.kind === "video" ? "mp4" : item.kind === "audio" ? "mp3" : "png";
      const saved = await saveToDrive(item.url!, `higgsview-${item.modelId}-${new Date(item.createdAt).toISOString().slice(0, 19).replace(/:/g, "-")}.${ext}`);
      await fetch("/api/export", { method: "POST", body: JSON.stringify({ id: item.id, link: saved.link, folder: saved.folder, folderName: saved.folderName }) });
      await refreshHistory();
    } catch (e) {
      setErr((e as Error).message);
      setState("error");
    }
  }
  return (
    <button onClick={exportIt} disabled={state === "busy"} title={err || `Save to your Google Drive → ${savedFolder()?.name ?? "My Drive › Higgsview"} (change the folder in your profile)`}
      className={`${ACTION} ${state === "error" ? "bg-red-500/20 text-red-300" : BLUE}`}>
      {state === "busy" ? "Saving…" : state === "error" ? "Retry Drive" : "▲ Google Drive"}
    </button>
  );
}
