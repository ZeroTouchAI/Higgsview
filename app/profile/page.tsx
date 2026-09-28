"use client";
import { useEffect, useReducer, useState, useSyncExternalStore } from "react";
import type { Profile } from "@/lib/auth";
import { initialsOf } from "@/components/AccountMenu";
import { ConnectKie, getKey, setKey } from "@/components/KeyGate";
import { canPickFolder, driveFolderUrl, folderLink, pickFolder, savedFolder, setSavedFolder } from "@/lib/google";

const FIELDS: [keyof Profile, string, string][] = [["firstName", "First name", "given-name"], ["lastName", "Last name", "family-name"]];
const noop = () => () => {};
const localStorageFolder = () => { const f = savedFolder(); return f ? JSON.stringify(f) : ""; }; // a string, so the snapshot compares stable
const input = "rounded-xl bg-chip px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-lime";

export default function ProfilePage() {
  const [p, setP] = useState<Profile>({});
  const [saved, setSaved] = useState("");
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const key = useSyncExternalStore(noop, getKey, () => ""); // localStorage: empty during server render
  const [changing, setChanging] = useState(false);
  const folder = useSyncExternalStore(noop, () => localStorageFolder(), () => "");
  const [folderErr, setFolderErr] = useState("");
  async function chooseFolder() {
    setFolderErr("");
    try { const f = await pickFolder(); if (f) { setSavedFolder(f); refresh(); } } catch (e) { setFolderErr((e as Error).message); }
  }
  useEffect(() => { fetch("/api/account").then((r) => r.json()).then(setP, () => {}); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/account", { method: "POST", body: JSON.stringify(p) });
    setSaved(r.ok ? "Saved" : "Couldn't save");
    if (r.ok) dispatchEvent(new Event("hv_profile")); // refresh the initials in the top bar
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center gap-4 pt-4">
        <span className="grid size-16 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#e8ff8a,#d1fe17_45%,#7a9a00)] text-xl font-black text-black">{initialsOf(p)}</span>
        <div>
          <h1 className="text-3xl font-black uppercase">Profile</h1>
          <p className="text-sm text-muted">Signed in with Google as {p.email ?? "…"}</p>
        </div>
      </div>

      <form onSubmit={save} className="grid gap-3 rounded-2xl bg-panel p-4 sm:grid-cols-2">
        {FIELDS.map(([k, label, auto]) => (
          <label key={k} className="flex flex-col gap-1 text-xs font-semibold text-muted">
            {label}
            <input className={input} value={p[k] ?? ""} autoComplete={auto} onChange={(e) => { setSaved(""); setP({ ...p, [k]: e.target.value }); }} />
          </label>
        ))}
        <div className="flex items-center gap-3 sm:col-span-2">
          <button className="rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-black hover:brightness-110">Save profile</button>
          {saved && <span className="text-sm text-muted">{saved}</span>}
        </div>
      </form>

      <section id="drive" className="flex flex-col gap-3 rounded-2xl bg-panel p-4">
        <h2 className="font-black uppercase">Google Drive folder</h2>
        <p className="text-sm text-muted">
          The ▲ Google Drive button saves to{" "}
          {folder ? <a href={folderLink(JSON.parse(folder).id)} target="_blank" rel="noreferrer" className="font-semibold text-fg underline">{JSON.parse(folder).name}</a>
            : <span className="font-semibold text-fg">My Drive › Higgsview</span>}.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={driveFolderUrl()} target="_blank" rel="noreferrer" className="rounded-xl px-4 py-2 text-sm font-semibold text-white [background-image:radial-gradient(39.71%_136.54%_at_51.64%_117.31%,#22D3EE_0%,#1f3f99_100%)] hover:brightness-110">↗ Open my Drive folder</a>
          {canPickFolder && <button onClick={chooseFolder} className="rounded-xl bg-chip px-4 py-2 text-sm font-semibold hover:bg-line">Choose folder…</button>}
          {folder && <button onClick={() => { setSavedFolder(undefined); refresh(); }} className="rounded-xl bg-chip px-4 py-2 text-sm font-semibold hover:bg-line">Use My Drive › Higgsview</button>}
        </div>
        {folderErr && <p role="alert" className="text-sm text-red-300">{folderErr}</p>}
      </section>

      <section id="key" className="flex flex-col gap-3 rounded-2xl bg-panel p-4">
        <h2 className="font-black uppercase">Kie.ai API key</h2>
        <p className="text-sm text-muted">
          {key ? <>Connected: <span className="font-mono text-fg">••••••••{key.slice(-4)}</span>. Stored only in this browser.</> : "No key in this browser."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setChanging(!changing)} className="rounded-xl bg-chip px-4 py-2 text-sm font-semibold hover:bg-line">{key ? "Change key" : "Add key"}</button>
          {key && <button onClick={() => { setKey(""); refresh(); }} className="rounded-xl bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/25">Remove key from this browser</button>}
        </div>
        {changing && <ConnectKie onDone={() => { refresh(); setChanging(false); }} />}
      </section>
    </div>
  );
}
