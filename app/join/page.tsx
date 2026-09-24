"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { refreshHistory, useHistory, type Item } from "@/lib/history";
import { recordClips, uploadFile } from "@/components/Controls";

// Join clips: stitch several videos (script scenes, long-video parts, anything in History) into one MP4 in the
// browser, optionally with a soundtrack (e.g. the generated voiceover), and save it to History permanently.
const stamp = () => ({ id: crypto.randomUUID(), createdAt: Date.now() }); // outside the component (purity lint)
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
      const clips = seq.map((id) => videos.find((v) => v.id === id)!);
      setStatus("Loading clips…");
      // Output size from the first clip's shape, ~720p.
      const meta = await new Promise<{ w: number; h: number }>((ok, fail) => {
        const v = Object.assign(document.createElement("video"), { crossOrigin: "anonymous", preload: "metadata", src: clips[0].url! });
        v.onloadedmetadata = () => ok({ w: v.videoWidth, h: v.videoHeight });
        v.onerror = () => fail(new Error("Couldn't load the first clip (Kie links expire after about 2 weeks)"));
      });
      const k = 1280 / Math.max(meta.w, meta.h);
      const even = (n: number) => Math.round((n * k) / 2) * 2;
      const blob = await recordClips(clips.map((c) => ({ src: c.url! })), even(meta.w), even(meta.h),
        (p) => setStatus(`Joining… ${p}% (plays in real time — keep this tab open)`), all.find((a) => a.id === soundtrack)?.url);
      setStatus("Saving…");
      const { id, createdAt } = stamp();
      const getUrl = await uploadFile(blob, `joined-${createdAt}.mp4`);
      const path = new URL(getUrl).pathname.slice(1); // uploads/…
      const item: Item = {
        id, kind: "video", modelId: "join", modelName: "Joined video", prompt: `Joined ${clips.length} clips${soundtrack ? " + soundtrack" : ""}`,
        url: `/api/file?p=${encodeURIComponent(path)}`, state: "success", usd: 0, createdAt,
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
        <p className="text-sm text-muted">Click videos in the order you want them. Add a soundtrack (like a generated voiceover) if you like. The joined video is saved to History for good.</p>
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
                <video src={v.url} muted preload="metadata" className="size-full object-contain" />
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
