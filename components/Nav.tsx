"use client";
import Link from "next/link";
import Badge from "@/components/Badge";
import AccountMenu from "@/components/AccountMenu";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MODELS } from "@/lib/models";

type Entry = [label: string, href: string, desc: string, badge?: string];
const models = (mode: string, path: string): Entry[] =>
  MODELS.filter((m) => m.mode === mode).map((m) => [m.name, `${path}?${mode === "create" || mode === "image" || mode === "audio" ? "" : `tab=${mode}&`}model=${m.id}`, m.desc, m.badge]);

// Mega menus, mirroring Higgsfield's Image / Video / Audio dropdowns.
const MENUS: Record<string, { features: Entry[]; models: Entry[] }> = {
  Image: {
    features: [
      ["Create Image", "/image", "Generate AI images", "TOP"],
      ["Cinematic Cameras", "/cinema", "Image generation with camera controls"],
      ["Edit Image", "/image?model=nano-banana-2", "Upload an image and describe the change"],
      ["Relight", "/apps/relight", "Adjust lighting and color temperature"],
      ["Image Upscale", "/apps/upscale-image", "Enhance image quality (Topaz)"],
      ["Expand Image", "/apps/expand-image", "Extend any image beyond its edges"],
      ["Face Swap", "/apps/face-swap", "Realistic face swaps"],
      ["Character Swap", "/apps/character-swap", "Swap the character in any image"],
      ["Headshot Generator", "/apps/headshot", "Studio-quality headshots"],
      ["Skin Enhancer", "/apps/skin-enhancer", "Natural skin retouching"],
      ["Outfit Swap", "/apps/outfit-swap", "Try on any outfit"],
      ["Angles", "/apps/angles", "Any camera angle of your image"],
      ["Background Remover", "/apps/remove-bg", "Clean cutouts"],
    ],
    models: models("image", "/image"),
  },
  Video: {
    features: [
      ["Create Video", "/video", "Generate AI videos", "TOP"],
      ["Cinema Studio", "/cinema", "Cinematic video with camera, lens and moves"],
      ["Genjutsu", "/video?tab=swap", "Transfer motion or swap objects from a reference video", "NEW"],
      ["Effects", "/effects", "Viral VFX presets"],
      ["Edit Video", "/video?tab=edit", "Change styles, objects and details"],
      ["Motion Control", "/video?tab=motion", "Transfer motion from a video to your image"],
      ["Recast", "/apps/recast", "Swap the character in any video"],
      ["Lipsync Studio", "/apps/lipsync", "Talking clips from a photo and audio"],
      ["Talking Avatar", "/apps/talking-avatar", "Script + voice + lip-sync"],
      ["UGC Factory", "/apps/ugc-ad", "UGC ads with a creator and your product"],
      ["Transitions", "/apps/transitions", "Seamless transitions between shots"],
      ["Video Upscale", "/apps/upscale-video", "Enhance video quality (Topaz)"],
    ],
    models: [...models("create", "/video"), ...models("swap", "/video"), ...models("motion", "/video"), ...models("edit", "/video")],
  },
  Audio: {
    features: [
      ["Text to Speech", "/audio?model=gemini-tts", "Natural voiceover from text", "CHEAP"],
      ["Music", "/audio?model=suno-music", "Songs and background music", "NEW"],
      ["Sound Effects", "/audio?model=suno-sfx", "Whooshes, ambience, SFX"],
      ["Talking Avatar", "/apps/talking-avatar", "Make a photo speak your script"],
      ["Lipsync Studio", "/apps/lipsync", "Sync a face to your own audio"],
    ],
    models: models("audio", "/audio"),
  },
};

const LINKS: [string, string, string?][] = [
  ["Effects", "/effects"],
  ["Cinema Studio", "/cinema"],
  ["Genjutsu", "/video?tab=swap", "New"],
  ["Apps", "/apps"],
  ["History", "/history"],
];

// Icons copied from higgsfield.ai's header (Pricing diamond, Enterprise sparkle).
const Diamond = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-4"><path stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" d="M8.5 7.75L6.25 10L8.5 12.25M12.7071 20.0429L22.049 10.701C22.4371 10.3129 22.4398 9.68443 22.0551 9.29295L16.901 4.04903C16.713 3.85774 16.4561 3.75 16.1879 3.75H7.81214C7.54393 3.75 7.28696 3.85774 7.09895 4.04903L1.94493 9.29295C1.56016 9.68443 1.56288 10.3129 1.95102 10.701L11.2929 20.0429C11.6834 20.4334 12.3166 20.4334 12.7071 20.0429Z" /></svg>
);
const Sparkle = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-4"><path stroke="currentColor" strokeLinecap="square" strokeLinejoin="round" strokeWidth="1.5" d="M12 2.75C13 8 16 11 21.25 12 16 13 13 16 12 21.25 11 16 8 13 2.75 12 8 11 11 8 12 2.75Z" /></svg>
);
const pill = "relative flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium whitespace-nowrap";

export default function Nav() {
  return <Suspense><NavInner /></Suspense>;
}

function NavInner() {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState<string>();
  const [credits, setCredits] = useState<number | null>(); // Kie balance in credits (null = no key)
  const [perDay, setPerDay] = useState<number>(); // average $/day over the last 7 days
  const [fresh, setFresh] = useState(0); // new Higgsfield features waiting in Upcoming
  const [month, setMonth] = useState<number>(); // this month's spend, shown in the Spending bubble
  // Opening Higgsview triggers the daily Higgsfield check (server re-scans if the last one is >24h old).
  useEffect(() => {
    fetch("/api/upcoming").then((r) => r.json()).then((d) => setFresh(Object.values(d.items ?? {}).filter((t) => (t as { status: string }).status === "new").length), () => {});
  }, []);
  useEffect(() => {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const week = Date.now() - 7 * 864e5;
    fetch("/api/history").then((r) => r.json()).then((items: { createdAt: number; usd?: number }[]) => {
      const sum = (from: number) => items.filter((i) => i.createdAt >= from).reduce((s, i) => s + (i.usd ?? 0), 0);
      setMonth(sum(start));
      setPerDay(sum(week) / 7 || undefined);
    }, () => {});
  }, [path]);
  useEffect(() => {
    fetch("/api/credits").then((r) => r.json()).then((d) => setCredits(typeof d.credits === "number" ? d.credits : null), () => {});
  }, [path]);
  // Close the menu after navigating (URL change) or on Escape.
  const url = path + "?" + sp.toString();
  const [lastUrl, setLastUrl] = useState(url);
  if (url !== lastUrl) { setLastUrl(url); setOpen(undefined); }
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(undefined);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, []);
  if (path === "/login") return null;

  const current = (href: string) => {
    const [p, q] = href.split("?");
    return p === path && (!q || sp.toString().includes(q));
  };
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/90 backdrop-blur">
      <div className="flex h-14 items-center gap-1 px-4">
        <Link href="/" className="mr-1 shrink-0" aria-label="Higgsview home" title="Higgsview">
          <span className="grid size-8 place-items-center rounded-lg bg-fg text-lg font-black text-black">H</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link href="/" className={`shrink-0 rounded-lg px-2 py-1.5 font-medium hover:text-fg ${path === "/" ? "text-lime" : "text-muted"}`}>Explore</Link>
          {Object.keys(MENUS).map((name) => (
            <button key={name} aria-expanded={open === name} onClick={() => setOpen(open === name ? undefined : name)}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 font-medium hover:text-fg ${open === name || path === `/${name.toLowerCase()}` ? "text-lime" : "text-muted"}`}>
              {name} <span aria-hidden className={`text-[10px] transition-transform ${open === name ? "rotate-180" : ""}`}>▾</span>
            </button>
          ))}
          {LINKS.map(([label, href, tag]) => (
            <Link key={label} href={href}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium transition-colors hover:text-fg ${current(href) ? "text-lime" : "text-muted"}`}>
              {label}
              {tag && <span className="rounded-md bg-lime/15 px-1.5 text-[10px] font-bold text-lime">{tag}</span>}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          <Link href="/spend" className={`${pill} bg-white/5 hover:bg-white/10 ${path === "/spend" ? "text-lime" : "text-fg"}`}>
            <Diamond /> Spending
            {month != null && (
              <span className="absolute top-7 left-1/2 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[10px] leading-3 font-bold text-white uppercase [background-image:radial-gradient(39.71%_136.54%_at_51.64%_117.31%,#F920D1_0%,#ED1572_100%)]">
                ${month.toFixed(2)} this mo
              </span>
            )}
          </Link>
          <Link href="/upcoming" className={`${pill} hidden md:flex ${path === "/upcoming" ? "text-lime" : "text-muted hover:text-fg"}`}>
            <Sparkle /> Upcoming
            {fresh > 0 && <span className="rounded-full bg-lime px-1.5 text-[10px] font-black text-black">{fresh}</span>}
          </Link>
          <span aria-hidden className="mx-1 h-3 w-px bg-white/15" />
          <a href="https://kie.ai/billing" target="_blank" rel="noreferrer" title={credits ? `Kie.ai balance ≈ $${(credits * 0.005).toFixed(2)} — click to top up` : "Kie.ai balance"}
            className={`${pill} bg-lime/[.08] font-semibold text-lime hover:bg-lime/15`}>
            <span className="size-2 rounded-full bg-lime" /> {credits === undefined ? "…" : credits === null ? "No key" : `${Math.floor(credits).toLocaleString()} credits`}
          </a>
          <AccountMenu credits={credits ?? undefined} usdPerDay={perDay}
            onSignOut={() => fetch("/api/logout", { method: "POST" }).then(() => { router.replace("/login"); router.refresh(); })} />
        </div>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 top-14 z-30 bg-black/50" onClick={() => setOpen(undefined)} />
          <div className="absolute inset-x-0 top-14 z-40 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-line bg-[#111] p-4 shadow-2xl">
            <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
              {(["features", "models"] as const).map((col) => (
                <section key={col}>
                  <h3 className="mb-2 px-2 text-xs font-semibold tracking-wide text-muted uppercase">{col === "features" ? "Features" : "Models"}</h3>
                  <ul className="grid gap-0.5 sm:grid-cols-2">
                    {MENUS[open][col].map(([label, href, desc, badge]) => (
                      <li key={href + label}>
                        <Link href={href} className="flex flex-col rounded-xl px-2 py-2 hover:bg-chip">
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            {label}
                            <Badge label={badge} />
                          </span>
                          <span className="line-clamp-1 text-xs text-muted">{desc}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
