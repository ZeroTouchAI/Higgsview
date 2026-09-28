"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { refreshHistory, useHistory, type Item } from "@/lib/history";
import { recordClips } from "@/components/Controls";
import { driveToken, saveToDrive } from "@/lib/google";
import { tell } from "@/components/Dialog";

// Join clips: stitch several videos (script scenes, long-video parts, anything in History) into one MP4 in the
// browser, optionally with a soundtrack (e.g. the generated voiceover), and save it straight to the user's own
// Google Drive (nothing is stored on our server). History keeps a card that opens it in Drive.
const stamp = () => ({ id: crypto.randomUUID(), createdAt: Date.now() }); // outside the component (purity lint)
// Fresh copy as a local blob: the History cards already loaded these files without CORS, and Chrome reuses
// that cached copy (no Access-Control header), which makes the canvas recorder fail with "Format error".
const local = async (u: string) => {
  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new Error("Couldn't load a clip (Kie links expire after about 2 weeks)");
  return URL.createObjectURL(await r.blob());
};
const order = (i: Item) => Number(i.modelName.match(/(?:Scene|Part) (\d+)/)?.[1] ?? 0);

export default function JoinPage() {
  return <Suspense><Join /></Suspense>;
}

function Join() {
  const sp = useSearchParams();
  const router = useRouter();
  const group = sp.get("group");
  const all = useHistory().filter((i) => i.state === "success" && i.url);
  const videos = all.filter((i) => i.kind === "video");
  const audios = all.filter((i) => i.kind === "audio");
  // Preselect a group (scenes in order + its voiceover) once history has loaded.
  const groupVids = group ? videos.filter((i) => i.group === group).sort((a, b) => order(a) - order(b)).map((i) => i.id) : [];
  const [picked, setPicked] = useState<string[]>();
  const [track, setTrack] = useState<string>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const seq = picked ?? groupVids;
  const soundtrack = track ?? (group ? audios.find((i) => i.group === group)?.id ?? "" : "");
  const toggle = (id: string) => setPicked(seq.includes(id) ? seq.filter((x) => x !== id) : [...seq, id]);

  async function join() {
    setError("");
    try {
      // Ask for Drive access now, while the click still counts as a user action (Google blocks the popup later).
      setStatus("Connecting Google Drive…");
      await driveToken();
      const clips = seq.map((id) => videos.find((v) => v.id === id)!);
      setStatus("Loading clips…");
      const srcs = await Promise.all(clips.map((c) => local(c.url!)));
      const track = all.find((a) => a.id === soundtrack)?.url;
      // Output size from the first clip's shape, ~720p.
      const meta = await new Promise<{ w: number; h: number }>((ok, fail) => {
        const v = Object.assign(document.createElement("video"), { preload: "metadata", src: srcs[0] });
        v.onloadedmetadata = () => ok({ w: v.videoWidth, h: v.videoHeight });
        v.onerror = () => fail(new Error("Couldn't load the first clip (Kie links expire after about 2 weeks)"));
      });
      const k = 1280 / Math.max(meta.w, meta.h);
      const even = (n: number) => Math.round((n * k) / 2) * 2;
      const blob = await recordClips(srcs.map((src) => ({ src })), even(meta.w), even(meta.h),
        (p) => setStatus(`Joining… ${p}% (plays in real time — keep this tab open)`), track && await local(track));
      setStatus("Saving to your Google Drive…");
      const { id, createdAt } = stamp();
      const name = `higgsview-joined-${new Date(createdAt).toISOString().slice(0, 19).replace(/:/g, "-")}.mp4`;
      const saved = await saveToDrive(blob, name).catch(async (e: Error) => {
        // Drive failed: don't lose the work, hand the file to the browser instead.
        const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
        a.click();
        await tell("Saved to your computer instead", `Couldn't save to Google Drive (${e.message}), so the joined video was downloaded to your computer.`);
        return undefined;
      });
      if (!saved) { setStatus(""); return; }
      const item: Item = {
        id, kind: "video", modelId: "join", modelName: "Joined video", prompt: `Joined ${clips.length} clips${soundtrack ? " + soundtrack" : ""}`,
        driveLink: saved.link, driveFolder: { link: saved.folder, name: saved.folderName }, state: "success", usd: 0, createdAt,
      };
      await fetch("/api/history", { method: "POST", body: JSON.stringify([item]) });
      await refreshHistory();
      router.push("/history");
    } catch (e) {
      setError((e as Error).message);
      setStatus("");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
      <header>
        <h1 className="text-3xl font-black uppercase">Join clips</h1>
        <p className="text-sm text-muted">Click videos in the order you want them. Add a soundtrack (like a generated voiceover) if you like. The joined video is saved to your Google Drive.</p>
      </header>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl bg-panel p-3">
        <span className="text-sm font-semibold">Sequence ({seq.length}):</span>
        {seq.map((id, n) => <span key={id} className="rounded-md bg-lime/15 px-2 py-1 text-xs text-lime">{n + 1}. {videos.find((v) => v.id === id)?.modelName.split(" · ").pop()}</span>)}
        <label className="ml-auto flex items-center gap-2 text-sm">
          Soundtrack
          <select value={soundtrack} onChange={(e) => setTrack(e.target.value)} className="max-w-56 rounded-lg bg-chip px-2 py-1.5 text-sm">
            <option value="">None (keep clip audio)</option>
            {audios.map((a) => <option key={a.id} value={a.id}>{a.modelName}: {a.prompt.slice(0, 40)}</option>)}
          </select>
        </label>
        <button onClick={join} disabled={seq.length < 1 || !!status} className="rounded-xl bg-lime px-5 py-2 text-sm font-bold text-black disabled:opacity-40">{status ? "Working…" : `Join ${seq.length} clip${seq.length === 1 ? "" : "s"}`}</button>
      </section>
      {status && <p role="status" className="text-sm text-lime">{status}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {videos.map((v) => {
          const n = seq.indexOf(v.id);
          return (
            <button key={v.id} onClick={() => toggle(v.id)} className={`overflow-hidden rounded-xl bg-panel text-left ring-lime ${n >= 0 ? "ring-2" : "hover:ring-1"}`}>
              <div className="relative aspect-video bg-black">
                <video src={v.url} muted preload="metadata" className="size-full object-cover object-[50%_30%]" />
                {n >= 0 && <span className="absolute top-2 left-2 grid size-6 place-items-center rounded-full bg-lime text-xs font-black text-black">{n + 1}</span>}
              </div>
              <p className="line-clamp-1 p-2 text-xs text-muted">{v.modelName} · {v.prompt}</p>
            </button>
          );
        })}
        {!videos.length && <p className="text-sm text-muted">No finished videos yet.</p>}
      </div>
    </div>
  );
}
