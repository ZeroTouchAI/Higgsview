"use client";
import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID, loadGoogle } from "@/lib/google";

export default function Login() {
  const button = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState(GOOGLE_CLIENT_ID ? "" : "Sign-in isn't set up yet (NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing).");
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    loadGoogle().then((g) => {
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          const r = await fetch("/api/login", { method: "POST", body: JSON.stringify({ credential }) });
          if (r.ok) location.replace("/");
          else setErr((await r.json().catch(() => ({}))).error ?? "Sign-in failed, try again");
        },
      });
      g.accounts.id.renderButton(button.current!, { theme: "filled_black", size: "large", shape: "pill", text: "continue_with", width: 280 });
    }, (e) => setErr(e.message));
  }, []);
  return (
    <div className="m-auto mt-32 flex w-[340px] flex-col items-center gap-4 rounded-2xl bg-panel p-8 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-fg text-2xl font-black text-black">H</span>
      <h1 className="text-3xl font-black uppercase">Higgsview</h1>
      <p className="text-sm text-fg/80">Free AI video &amp; image studio. Every top model, at raw Kie.ai prices: no subscription.</p>
      <div ref={button} className="min-h-11" />
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      <p className="text-xs text-muted">Sign in with Google to keep your history on every device.</p>
    </div>
  );
}
