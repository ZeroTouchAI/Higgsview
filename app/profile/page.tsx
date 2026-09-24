"use client";
import { useEffect, useState } from "react";
import type { Profile } from "@/lib/auth";
import { initialsOf } from "@/components/AccountMenu";

const FIELDS: [keyof Profile, string, string][] = [
  ["firstName", "First name", "given-name"], ["lastName", "Last name", "family-name"],
  ["username", "Username", "username"], ["email", "Email", "email"],
];
const input = "rounded-xl bg-chip px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-lime";

export default function ProfilePage() {
  const [p, setP] = useState<Profile>({});
  const [saved, setSaved] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<[boolean, string]>();
  useEffect(() => { fetch("/api/account").then((r) => r.json()).then(setP, () => {}); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/account", { method: "POST", body: JSON.stringify(p) });
    setSaved(r.ok ? "Saved" : "Couldn't save");
    if (r.ok) dispatchEvent(new Event("hv_profile")); // refresh the initials in the top bar
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) return setPwMsg([false, "New passwords don't match"]);
    const d = await fetch("/api/account/password", { method: "POST", body: JSON.stringify({ current: pw.current, next: pw.next }) }).then((r) => r.json());
    setPwMsg(d.ok ? [true, "Password changed. Other browsers will need to log in again."] : [false, d.error]);
    if (d.ok) setPw({ current: "", next: "", confirm: "" });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center gap-4 pt-4">
        <span className="grid size-16 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#e8ff8a,#d1fe17_45%,#7a9a00)] text-xl font-black text-black">{initialsOf(p)}</span>
        <div>
          <h1 className="text-3xl font-black uppercase">Profile</h1>
          <p className="text-sm text-muted">Your initials come from your first and last name.</p>
        </div>
      </div>

      <form onSubmit={save} className="grid gap-3 rounded-2xl bg-panel p-4 sm:grid-cols-2">
        {FIELDS.map(([k, label, auto]) => (
          <label key={k} className="flex flex-col gap-1 text-xs font-semibold text-muted">
            {label}
            <input className={input} value={p[k] ?? ""} autoComplete={auto} type={k === "email" ? "email" : "text"} onChange={(e) => { setSaved(""); setP({ ...p, [k]: e.target.value }); }} />
          </label>
        ))}
        <div className="flex items-center gap-3 sm:col-span-2">
          <button className="rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-black hover:brightness-110">Save profile</button>
          {saved && <span className="text-sm text-muted">{saved}</span>}
        </div>
      </form>

      <form onSubmit={changePw} className="grid gap-3 rounded-2xl bg-panel p-4">
        <h2 className="font-black uppercase">Change password</h2>
        {([["current", "Current password", "current-password"], ["next", "New password (8+ characters)", "new-password"], ["confirm", "Confirm new password", "new-password"]] as const).map(([k, label, auto]) => (
          <label key={k} className="flex flex-col gap-1 text-xs font-semibold text-muted">
            {label}
            <input className={input} type="password" autoComplete={auto} value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={!pw.current || !pw.next} className="rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40">Change password</button>
          {pwMsg && <span role="status" className={`text-sm ${pwMsg[0] ? "text-lime" : "text-red-300"}`}>{pwMsg[1]}</span>}
        </div>
      </form>
    </div>
  );
}
