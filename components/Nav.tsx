"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  ["Spending", "/spend"],
];

export default function Nav() {
  return <Suspense><NavInner /></Suspense>;
}

function NavInner() {
  const path = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState<string>();
  const [bal, setBal] = useState<string>();
  useEffect(() => {
    fetch("/api/credits").then((r) => r.json()).then((d) => setBal(d.usd != null ? `$${d.usd.toFixed(2)}` : "No key"), () => {});
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
        <Link href="/" className="mr-3 flex items-center gap-2" aria-label="Higgsview home">
          <span className="grid size-8 place-items-center rounded-lg bg-fg text-lg font-black text-black">H</span>
          <span className="hidden font-bold tracking-tight sm:inline">Higgsview</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
          <Link href="/" className={`shrink-0 rounded-lg px-2.5 py-1.5 font-medium hover:text-fg ${path === "/" ? "text-lime" : "text-muted"}`}>Explore</Link>
          {Object.keys(MENUS).map((name) => (
            <button key={name} aria-expanded={open === name} onClick={() => setOpen(open === name ? undefined : name)}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium hover:text-fg ${open === name || path === `/${name.toLowerCase()}` ? "text-lime" : "text-muted"}`}>
              {name} <span aria-hidden className={`text-[10px] transition-transform ${open === name ? "rotate-180" : ""}`}>▾</span>
            </button>
          ))}
          {LINKS.map(([label, href, tag]) => (
            <Link key={label} href={href}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors hover:text-fg ${current(href) ? "text-lime" : "text-muted"}`}>
              {label}
              {tag && <span className="rounded-md bg-lime/15 px-1.5 text-[10px] font-bold text-lime">{tag}</span>}
            </Link>
          ))}
        </nav>
        <a href="https://kie.ai/billing" target="_blank" rel="noreferrer" title="Kie.ai balance — click to top up"
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-chip px-3 py-1.5 text-sm font-semibold whitespace-nowrap">
          <span className="size-2 rounded-full bg-lime" /> {bal ?? "…"}
        </a>
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
                            {badge && <span className="rounded bg-lime px-1 text-[9px] font-black text-black">{badge}</span>}
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
