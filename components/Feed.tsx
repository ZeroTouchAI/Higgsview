"use client";
import { useState } from "react";
import { refreshHistory, removeItem, type Item } from "@/lib/history";
import { appById } from "@/lib/apps";

type Act = ((i: Item) => void) | undefined;
export default function Feed({ items, kind, onReuse, onContinue, onExtend }: { items: Item[]; kind: "video" | "image"; onReuse?: Act; onContinue?: Act; onExtend?: Act }) {
  if (!items.length) return <HowItWorks kind={kind} />;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {items.map((i) => (
        <figure key={i.id} className="overflow-hidden rounded-xl bg-panel">
          <div className="relative grid aspect-video place-items-center bg-black">
            {i.state === "success" && i.url ? (
              i.kind === "audio" ? <audio src={i.url} controls className="w-11/12" />
              : i.kind === "video" ? <video src={i.url} controls loop playsInline className="size-full object-contain" />
                : <RetryImg src={i.url} alt={i.prompt} />
            ) : i.state === "pending" ? (
              <div className="flex flex-col items-center gap-2 text-sm text-muted">
                <span className="size-8 animate-spin rounded-full border-2 border-line border-t-lime" />
                Generating…{i.app && (appById(i.app.id)?.steps.length ?? 1) > 1 && ` step ${i.app.step + 1} of ${appById(i.app.id)!.steps.length}`}
              </div>
            ) : (
              <p className="p-4 text-center text-sm text-red-300">{i.error}</p>
            )}
          </div>
          <figcaption className="flex flex-col gap-2 p-3 text-xs">
            <p className="line-clamp-2 text-fg/80">{i.prompt}</p>
            <div className="flex flex-wrap items-center gap-2 text-muted">
              <span className="rounded bg-chip px-1.5 py-0.5">{i.modelName}</span>
              {i.usd != null && <span className="rounded bg-chip px-1.5 py-0.5">${i.usd.toFixed(2)}</span>}
              <span>{new Date(i.createdAt).toLocaleString()}</span>
              <span className="ml-auto flex gap-1">
                {onReuse && <button onClick={() => onReuse(i)} className="rounded bg-chip px-2 py-1 hover:text-fg">Reuse</button>}
                {onContinue && i.lastFrame && <button onClick={() => onContinue(i)} title="Start a new clip from this clip's last frame" className="rounded bg-chip px-2 py-1 hover:text-fg">Continue →</button>}
                {onExtend && i.state === "success" && i.modelId.startsWith("grok") && <button onClick={() => onExtend(i)} title="Add 6-10s to this video" className="rounded bg-chip px-2 py-1 hover:text-fg">Extend +</button>}
                {i.url && <a href={i.url} target="_blank" rel="noreferrer" download className="rounded bg-chip px-2 py-1 hover:text-fg">Download</a>}
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

function HowItWorks({ kind }: { kind: "video" | "image" }) {
  const steps = kind === "video"
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

// Free providers render on request and can time out the first load; remount to retry.
function RetryImg({ src, alt }: { src: string; alt: string }) {
  const [tries, setTries] = useState(0);
  return <img key={tries} src={src} alt={alt} className="size-full object-contain"
    onError={() => tries < 5 && setTimeout(() => setTries(tries + 1), 4000)} />;
}

function DriveButton({ item }: { item: Item }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  if (item.driveLink)
    return <a href={item.driveLink} target="_blank" rel="noreferrer" className="rounded bg-lime/15 px-2 py-1 text-lime">✓ In Drive</a>;
  async function exportIt() {
    setState("busy");
    const d = await fetch("/api/export", { method: "POST", body: JSON.stringify({ id: item.id }) }).then((r) => r.json()).catch(() => ({}));
    if (d.link) await refreshHistory();
    else setState("error");
  }
  return (
    <button onClick={exportIt} disabled={state === "busy"} title="Save to Google Drive → My Drive/Higgsview"
      className={`rounded bg-chip px-2 py-1 hover:text-fg ${state === "error" ? "text-red-300" : ""}`}>
      {state === "busy" ? "Saving…" : state === "error" ? "Retry Drive" : "Export to Drive"}
    </button>
  );
}
