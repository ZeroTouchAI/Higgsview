"use client";
import { useEffect, useState } from "react";
import type { Status, Tracked, Upcoming } from "@/lib/upcoming";

const SECTIONS: [Status, string, string][] = [
  ["new", "New on Higgsfield", "Appeared since the last check: ready to build."],
  ["todo", "Not built yet", "On Higgsfield today, not in Higgsview yet."],
  ["built", "Built", "Already in Higgsview."],
  ["ignored", "Ignored", "Marketing pages, guides and things we skipped."],
];

export default function UpcomingPage() {
  const [data, setData] = useState<Upcoming>();
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const fetchIt = (force = false) => fetch(`/api/upcoming${force ? "?force=1" : ""}`).then((r) => r.json()).then(setData);
  const load = (force = false) => { setBusy(true); fetchIt(force).finally(() => setBusy(false)); };
  useEffect(() => { fetchIt(); }, []);
  const mark = async (path: string, status: Status) =>
    setData(await fetch("/api/upcoming", { method: "POST", body: JSON.stringify({ path, status }) }).then((r) => r.json()));

  const entries = Object.entries(data?.items ?? {}).filter(([, t]) => t.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black uppercase">Upcoming</h1>
          <p className="text-sm text-muted">
            Higgsview checks Higgsfield&apos;s site once a day when you open it.
            {data?.checkedAt ? ` Last check: ${new Date(data.checkedAt).toLocaleString()}.` : ""}
          </p>
          {data?.error && <p className="text-sm text-red-300">{data.error}</p>}
        </div>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search" className="rounded-lg bg-chip px-3 py-1.5 text-sm outline-none" />
          <button onClick={() => load(true)} disabled={busy} className="rounded-lg bg-lime px-3 py-1.5 text-sm font-bold text-black disabled:opacity-50">{busy ? "Checking…" : "Check now"}</button>
        </div>
      </header>
      {SECTIONS.map(([status, title, blurb]) => {
        const rows = entries.filter(([, t]) => t.status === status).sort((a, b) => b[1].firstSeen - a[1].firstSeen || a[1].kind.localeCompare(b[1].kind));
        return (
          <details key={status} open={status === "new" || status === "todo"} className="rounded-2xl bg-panel p-4">
            <summary className="cursor-pointer list-none">
              <span className="text-lg font-black uppercase">{title}</span>
              <span className={`ml-2 rounded-md px-1.5 text-xs font-bold ${status === "new" && rows.length ? "bg-lime text-black" : "bg-chip text-muted"}`}>{rows.length}</span>
              <span className="ml-3 text-xs text-muted">{blurb}</span>
            </summary>
            <ul className="mt-3 grid gap-1">
              {rows.map(([path, t]: [string, Tracked]) => (
                <li key={path} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-chip">
                  <span className="w-16 shrink-0 text-[11px] font-semibold text-muted uppercase">{t.kind}</span>
                  <a href={t.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-lime">{t.name} ↗</a>
                  {status === "new" && <span className="text-xs text-muted">seen {new Date(t.firstSeen).toLocaleDateString()}</span>}
                  {t.note && <span className="text-xs text-muted">— {t.note}</span>}
                  <span className="ml-auto flex gap-1 text-xs">
                    {(["built", "todo", "ignored"] as Status[]).filter((s) => s !== status).map((s) => (
                      <button key={s} onClick={() => mark(path, s)} className="rounded bg-chip px-2 py-1 capitalize hover:text-lime">{s === "todo" ? "To build" : s === "built" ? "Mark built" : "Ignore"}</button>
                    ))}
                  </span>
                </li>
              ))}
              {!rows.length && <li className="text-sm text-muted">Nothing here.</li>}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
