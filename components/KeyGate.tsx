"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { kieUrl } from "@/lib/kieLinks";

// Each user's Kie.ai API key lives only in their browser (localStorage). It rides along with every request to our
// /api routes as the x-kie-key header and is never saved on the server (see lib/kie.ts).
const STORE = "hv_kie_key";
export const getKey = () => { try { return localStorage.getItem(STORE) ?? ""; } catch { return ""; } };
export const setKey = (k: string) => {
  try { if (k) localStorage.setItem(STORE, k); else localStorage.removeItem(STORE); } catch {}
  dispatchEvent(new Event("hv_key")); // Nav reloads the balance
};

// ponytail: patches window.fetch once so every existing fetch("/api/…") call carries the key; an api() wrapper
// at each call site would be cleaner if this ever misbehaves.
if (typeof window !== "undefined" && !("hvKeyPatch" in window)) {
  const orig = window.fetch.bind(window);
  Object.assign(window, { hvKeyPatch: true });
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith(location.origin) ? url.slice(location.origin.length) : url;
    const key = getKey();
    if (key && path.startsWith("/api/")) {
      const h = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!h.has("x-kie-key")) h.set("x-kie-key", key);
      init = { ...init, headers: h };
    }
    return orig(input, init);
  };
}

// Blocks the app until the user has connected a Kie.ai key (the owner can use the server's key: /api/credits works).
export default function KeyGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [need, setNeed] = useState(false);
  const open = path === "/login" || path === "/privacy"; // public pages
  useEffect(() => {
    if (open) return;
    fetch("/api/credits").then((r) => r.json()).then((d) => setNeed(typeof d.credits !== "number" && !getKey()), () => {});
  }, [open]);
  if (open || !need) return <>{children}</>;
  return <ConnectKie onDone={() => setNeed(false)} />;
}

export function ConnectKie({ onDone }: { onDone: () => void }) {
  const [key, setK] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const d = await fetch("/api/credits", { headers: { "x-kie-key": key.trim() } }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (typeof d.credits !== "number") return setErr("That key didn't work. Copy it again from kie.ai → API Keys.");
    setKey(key.trim());
    onDone();
  }
  const step = "flex gap-3 rounded-2xl bg-white/[.04] p-4";
  const num = "grid size-7 shrink-0 place-items-center rounded-full bg-lime text-sm font-black text-black";
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 pt-10">
      <h1 className="text-3xl font-black uppercase">Connect your Kie.ai account</h1>
      <p className="text-sm text-fg/80">
        Higgsview is free. The AI models run on <b>your own Kie.ai account</b>, so you pay Kie.ai&apos;s raw prices directly
        (pay as you go, no subscription). Takes about a minute:
      </p>
      <div className={step}>
        <span className={num}>1</span>
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Create your free Kie.ai account</p>
          <a href={kieUrl()} target="_blank" rel="noreferrer" className="w-fit rounded-xl bg-lime px-4 py-2 text-sm font-bold text-black hover:brightness-110">Sign up at Kie.ai ↗</a>
          <p className="text-xs text-muted">Then add a little credit under Billing (a few dollars goes a long way).</p>
        </div>
      </div>
      <div className={step}>
        <span className={num}>2</span>
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Copy your API key</p>
          <a href={kieUrl("/api-key")} target="_blank" rel="noreferrer" className="w-fit rounded-xl bg-chip px-4 py-2 text-sm font-semibold hover:bg-line">Open Kie.ai → API Keys ↗</a>
        </div>
      </div>
      <form onSubmit={connect} className={step}>
        <span className={num}>3</span>
        <div className="flex flex-1 flex-col gap-2">
          <p className="font-semibold">Paste it here</p>
          <input value={key} onChange={(e) => setK(e.target.value)} placeholder="Your Kie.ai API key" aria-label="Kie.ai API key" autoComplete="off" spellCheck={false}
            className="rounded-xl bg-chip px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-lime" />
          {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
          <button disabled={!key.trim() || busy} className="w-fit rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40">{busy ? "Checking…" : "Connect"}</button>
          <p className="text-xs text-muted">🔒 Your key is stored only in this browser. Higgsview never saves it on its servers. You can remove it anytime in your profile.</p>
        </div>
      </form>
    </div>
  );
}
