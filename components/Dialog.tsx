"use client";
import { useEffect, useRef, useState } from "react";

// App-styled replacement for window.confirm/alert: a centered dialog. Call `ask(...)` / `tell(...)` from anywhere
// (they return promises); <DialogHost /> in the root layout renders whichever one is open.
type Opts = { title: string; message: string; cost?: number; confirm?: string; cancel?: string | false; tone?: "pay" | "danger" | "info" };
type Open = Opts & { done: (ok: boolean) => void };
let show: ((o: Open | undefined) => void) | undefined;

export const ask = (o: Opts) => new Promise<boolean>((done) => (show ? show({ ...o, done }) : done(window.confirm(o.message))));
export const askToPay = (cost: number, what = "This") =>
  ask({ title: "Confirm payment", message: `${what} will be charged to your Kie.ai balance.`, cost, confirm: `Pay ≈ $${cost.toFixed(2)}`, tone: "pay" });
export const tell = (title: string, message: string) => ask({ title, message, confirm: "OK", cancel: false, tone: "info" }).then(() => {});

export default function DialogHost() {
  const [open, setOpen] = useState<Open>();
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => { show = setOpen; return () => { show = undefined; }; }, []);
  useEffect(() => {
    if (!open) return;
    ok.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(false); };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });
  if (!open) return null;
  function close(result: boolean) { open!.done(result); setOpen(undefined); }
  const main = open.tone === "danger" ? "bg-red-500 text-white" : "bg-lime text-black";
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => open.cancel !== false && close(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="hv-dialog-title" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1b1c1e] p-5 shadow-2xl">
        <h2 id="hv-dialog-title" className="text-lg font-black uppercase">{open.title}</h2>
        {open.cost != null && (
          <p className="mt-3 flex items-baseline justify-between rounded-xl bg-white/[.04] px-4 py-3">
            <span className="text-sm text-muted">Estimated cost</span>
            <span className="text-2xl font-black text-lime">${open.cost.toFixed(2)}</span>
          </p>
        )}
        <p className="mt-3 text-sm whitespace-pre-line text-fg/80">{open.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          {open.cancel !== false && <button onClick={() => close(false)} className="rounded-xl bg-chip px-4 py-2.5 text-sm font-semibold hover:bg-line">{open.cancel ?? "Cancel"}</button>}
          <button ref={ok} onClick={() => close(true)} className={`rounded-xl px-5 py-2.5 text-sm font-bold hover:brightness-110 ${main}`}>{open.confirm ?? "Continue"}</button>
        </div>
      </div>
    </div>
  );
}
