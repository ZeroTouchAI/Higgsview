"use client";
import { kieUrl } from "@/lib/kieLinks";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Profile } from "@/lib/auth";

// Account circle + dropdown, modeled on Higgsfield's: profile, a credits card with a "runway" meter,
// shortcuts into the Kie.ai dashboard (the real account behind Higgsview), and Sign Out.
const KIE: [string, string, string][] = [
  ["API Keys", kieUrl("/api-key"), "M15 7a4 4 0 1 1-3.8 5.2L4 19.5V22h3v-2h2v-2h2l1.2-1.2A4 4 0 0 1 15 7Z"],
  ["Billing", kieUrl("/billing"), "M3 6h18v12H3zM3 10h18"],
  ["Logs", kieUrl("/logs"), "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"],
];
const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-[18px] shrink-0 text-fg/70"><path d={d} /></svg>
);
const VERSION = "2.13"; // bump on EVERY change pushed (also package.json)
// Help & feedback: opens a Gmail draft (everyone signs in with Google) to the owner's inbox, with the account
// email and version filled in so replies are easy.
export const helpMail = (email?: string) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=info@zerotouchai.com&su=${encodeURIComponent(`Higgsview help / feedback (v${VERSION})`)}&body=${encodeURIComponent(`Hi,

[Describe the problem or idea here. Screenshots help!]

---
Account: ${email ?? "?"}
Higgsview v${VERSION}`)}`;
const row = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium hover:bg-white/5";

export const initialsOf = (p: Profile) =>
  ((p.firstName?.[0] ?? "") + (p.lastName?.[0] ?? "")).toUpperCase() || (p.email ?? "HV").slice(0, 2).toUpperCase();

export default function AccountMenu({ credits, onSignOut }: { credits?: number; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  useEffect(() => {
    const load = () => fetch("/api/account").then((r) => r.json()).then(setProfile, () => {});
    load();
    addEventListener("hv_profile", load);
    return () => removeEventListener("hv_profile", load);
  }, []);

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email || "Higgsview";
  const DOTS = 28;
  const FULL = 10_000; // a full meter = 10,000 credits ($50)
  const filled = credits != null ? Math.min(DOTS, Math.max(credits > 0 ? 1 : 0, Math.round((credits / FULL) * DOTS))) : 0;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Account menu"
        className="grid size-9 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#e8ff8a,#d1fe17_45%,#7a9a00)] text-xs font-black text-black ring-2 ring-white/10 hover:ring-lime/60">
        {initialsOf(profile)}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-12 right-0 z-50 w-[340px] rounded-2xl border border-white/10 bg-[#1b1c1e] p-2 shadow-2xl">
            <div className="flex items-center gap-3 px-3 py-3">
              <span className="grid size-11 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#e8ff8a,#d1fe17_45%,#7a9a00)] text-sm font-black text-black">{initialsOf(profile)}</span>
              <div className="min-w-0">
                <p className="truncate font-bold">{name}</p>
                <p className="text-sm text-muted">Pay as you go · Kie.ai</p>
              </div>
              <span className="ml-auto self-start rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] font-semibold text-muted" title="Higgsview version">v{VERSION}</span>
            </div>

            <div className="rounded-xl bg-white/[.04] p-3">
              <a href={kieUrl("/billing")} target="_blank" rel="noreferrer" className="flex items-center justify-between">
                <span className="font-semibold" title="1 credit = $0.005">Credits <span className="text-muted">ⓘ</span></span>
                <span className="text-muted">{credits != null ? `${Math.floor(credits).toLocaleString()} left` : "…"} ›</span>
              </a>
              <div className="mt-3 flex gap-[3px]" aria-label={`${filled} of ${DOTS}`}>
                {Array.from({ length: DOTS }, (_, n) => (
                  <span key={n} className={`size-1.5 rounded-full ${n < filled ? (filled <= 4 ? "bg-[#ED1572]" : "bg-lime") : "bg-white/15"}`} />
                ))}
              </div>
              <div className="my-3 h-px bg-white/10" />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold"><span className="text-lime">♛</span> Top up credits</span>
                <a href={kieUrl("/billing")} target="_blank" rel="noreferrer" className="rounded-full bg-lime px-4 py-1.5 text-sm font-bold text-black hover:brightness-110">Top up</a>
              </div>
            </div>

            <div className="mt-2 flex flex-col">
              <Link href="/profile" onClick={() => setOpen(false)} className={row}><Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" /> View profile</Link>
              <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Kie.ai</p>
              {KIE.map(([label, href, d]) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" className={row}><Icon d={d} /> {label} <span className="ml-auto text-xs text-muted">↗</span></a>
              ))}
              <div className="my-1 h-px bg-white/10" />
              <a href={helpMail(profile.email)} target="_blank" rel="noreferrer" className={row}><Icon d="M4 6h16v12H4zM4 7l8 6 8-6" /> Help &amp; feedback</a>
              <div className="my-1 h-px bg-white/10" />
              <button onClick={onSignOut} className={row}><Icon d="M15 12H3m0 0 4-4m-4 4 4 4M13 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" /> Sign Out</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
