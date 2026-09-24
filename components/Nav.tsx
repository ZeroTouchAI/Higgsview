"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS: [string, string, string?][] = [
  ["Explore", "/"],
  ["Image", "/image"],
  ["Video", "/video"],
  ["Edit", "/video?tab=edit"],
  ["Motion Control", "/video?tab=motion"],
  ["Genjutsu", "/video?tab=swap", "New"],
  ["Presets", "/video?presets=1"],
  ["History", "/history"],
];

export default function Nav() {
  const path = usePathname();
  const [bal, setBal] = useState<string>();
  useEffect(() => {
    fetch("/api/credits").then((r) => r.json()).then((d) => setBal(d.usd != null ? `$${d.usd.toFixed(2)}` : "No key"), () => {});
  }, [path]);
  if (path === "/login") return null;
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-1 border-b border-line/60 bg-bg/90 px-4 backdrop-blur">
      <Link href="/" className="mr-3 flex items-center gap-2" aria-label="Higgsview home">
        <span className="grid size-8 place-items-center rounded-lg bg-fg text-lg font-black text-black">H</span>
        <span className="hidden font-bold tracking-tight sm:inline">Higgsview</span>
      </Link>
      <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
        {LINKS.map(([label, href, tag]) => {
          const active = href.split("?")[0] === path && (href === "/" || label !== "Explore");
          return (
            <Link key={label} href={href}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors hover:text-fg ${active && !href.includes("?") ? "text-lime" : "text-muted"}`}>
              {label}
              {tag && <span className="rounded-md bg-lime/15 px-1.5 text-[10px] font-bold text-lime">{tag}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <a href="https://kie.ai/billing" target="_blank" rel="noreferrer" title="Kie.ai balance — click to top up"
          className="flex items-center gap-1.5 rounded-lg bg-chip px-3 py-1.5 text-sm font-semibold">
          <span className="size-2 rounded-full bg-lime" /> {bal ?? "…"}
        </a>
      </div>
    </header>
  );
}
