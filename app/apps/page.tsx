"use client";
import Link from "next/link";
import Badge from "@/components/Badge";
import { useState } from "react";
import { APPS, CATEGORIES } from "@/lib/apps";

export default function AppsPage() {
  const [cat, setCat] = useState<keyof typeof CATEGORIES | "all">("all");
  const [q, setQ] = useState("");
  const cats = (Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).filter((c) => cat === "all" || c === cat);
  const match = (a: (typeof APPS)[number]) => (a.name + a.desc).toLowerCase().includes(q.toLowerCase());
  return (
    <div className="flex flex-col gap-6 p-4">
      <header className="flex flex-col gap-3 pt-6 text-center">
        <p className="text-sm font-semibold text-muted">WELCOME TO</p>
        <h1 className="text-5xl font-black tracking-tight uppercase">Higgsview Apps</h1>
        <p className="text-muted">One-click AI effects that turn any photo into ads, viral trends and studio shots.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps…" aria-label="Search apps"
          className="mx-auto w-full max-w-md rounded-xl bg-chip px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-lime" />
      </header>
      <nav className="flex flex-wrap justify-center gap-2 text-sm">
        {(["all", ...Object.keys(CATEGORIES)] as const).map((c) => (
          <button key={c} onClick={() => setCat(c as typeof cat)}
            className={`rounded-full px-3.5 py-1.5 font-semibold ${cat === c ? "bg-fg text-black" : "bg-chip text-muted hover:text-fg"}`}>
            {c === "all" ? "All" : CATEGORIES[c as keyof typeof CATEGORIES]}
          </button>
        ))}
      </nav>
      {cats.map((c) => {
        const apps = APPS.filter((a) => a.cat === c && match(a));
        if (!apps.length) return null;
        return (
          <section key={c} className="flex flex-col gap-3">
            <h2 className="text-2xl font-black tracking-tight uppercase">{CATEGORIES[c]}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {apps.map((a) => (
                <Link key={a.id} href={`/apps/${a.id}`} className="group flex flex-col overflow-hidden rounded-2xl bg-panel hover:ring-2 hover:ring-lime">
                  <div className="relative grid aspect-[4/3] place-items-center overflow-hidden text-4xl"
                    style={{ background: `linear-gradient(145deg, hsl(${[...a.id].reduce((h, ch) => h + ch.charCodeAt(0), 0) % 360} 45% 24%), #101010)` }}>
                    <span aria-hidden>{a.out === "video" ? "▶" : a.out === "audio" ? "♪" : "◼"}</span>
                    {/* Preview image (public/thumbs/<id>.jpg); hides itself if missing so the colored card shows. */}
                    <img src={`/thumbs/${a.id}.jpg`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => (e.currentTarget.style.display = "none")} />
                    {a.out === "video" && <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 text-[10px] font-bold">▶ VIDEO</span>}
                    <Badge label={a.badge} className="absolute top-2 left-2 z-10" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <h3 className="font-bold">{a.name}</h3>
                    <p className="line-clamp-2 flex-1 text-xs text-muted">{a.desc}</p>
                    <span className="mt-1 w-fit rounded-lg bg-chip px-3 py-1 text-xs font-semibold group-hover:bg-lime group-hover:text-black">Run</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
