// Higgsfield feature tracker. Reads Higgsfield's public sitemaps (apps, effects, product/model pages),
// compares them with what Higgsview has, and keeps a list in upcoming.json:
//   new = appeared since the first scan · todo = exists on Higgsfield, not built here · built · ignored
import { APPS } from "@/lib/apps";
import { mutateJson, readJson } from "@/lib/store";

export type Status = "new" | "todo" | "built" | "ignored";
export type Tracked = { name: string; kind: "App" | "Effect" | "Feature"; url: string; firstSeen: number; status: Status; note?: string };
export type Upcoming = { checkedAt: number; error?: string; items: Record<string, Tracked> };
const PATH = "upcoming.json";
const EMPTY: Upcoming = { checkedAt: 0, items: {} };
const DAY = 24 * 60 * 60 * 1000;

const SITEMAPS: [Tracked["kind"], string][] = [
  ["App", "https://higgsfield.ai/apps/sitemap.xml"],
  ["Effect", "https://higgsfield.ai/effects/sitemap.xml"],
  ["Feature", "https://higgsfield.ai/sitemap-marketing.xml"],
];
const LOCALE = /^\/[a-z]{2}(-[a-z0-9]{2,4})?(\/|$)/i; // /es/…, /pt-br/… translations
const NOISE = /prompt-guide|community|webinar|^\/mcp|^\/(enterprise|team-plan|pricing|earn|creator-partnership-program|about|trust|blog|contact|chat|apps|higgsfield-for-good|higgsfield-api)$|sora-2-(youtube|tiktok|reels|shorts|ai-video-presets)|^\/(sora-video|wan-video|viral)$/;
const APP_CATEGORIES = /^(camera-motion|enhance-style|face-identity|video-editing|ads-products|games-characters|extras|trending-templates)$/;
// Higgsfield slugs that map to something Higgsview already has under another name.
const ALIASES: Record<string, string> = {
  "ai-headshot-generator": "headshot", "image-background-remover": "remove-bg", "surrounded-by-animals": "micro-beasts", lidar: "lidar-transition",
};
const BUILT_PAGES = new Set(["/", "/ai-image", "/ai-video", "/cinematic-video-generator", "/storyboard-generator", "/image-editing", "/kling-3.0", "/flux-2-intro", "/gpt-2",
  "/seedream-5.0", "/seedream-5.0-pro", "/grok-imagine", "/seedance", "/seedance/2.0", "/seedance/2.5", "/veo3.1", "/genjutsu", "/wan-animate-ai-video", "/ai-ad-generator",
  "/ai-avatar-generator", "/ai-voice-generator", "/text-to-speech", "/ai-talking-avatar", "/ugc", "/camera-controls", "/effects", "/image-to-video-ai", "/text-to-video-ai",
  "/ai-video-upscaler", "/ai-image-upscaler", "/ai-video-extender", "/ai-product-video-generator", "/video-to-video", "/ai-voice-over", "/ai-image-extender", "/wan-ai-video", "/minimax"]);
// Real products (not SEO landing pages) worth building; other existing marketing pages start as "ignored".
const PRODUCTS = /-intro$|^\/(soul|character|ai-influencer|ai-influencer-studio|ai-motion-design|voice-cloning|ai-video-translator|remove-object-from-video|url-to-video|higgsfield-layers|marketing-automation|recraft-v4-styles|gemini-omni-flash|minimax\/h3|sora-2|wan-2\.6|grok-imagine-1\.5|ai-voice-changer|script-to-video|ai-long-video-generator|ai-video-background-changer|remove-text-from-video|ai-clothes-changer|ai-hairstyle-changer)$/;

// Higgsfield product pages → what covers them in Higgsview (or why they're skipped). Decided 2026-09-24.
const KNOWN: Record<string, [Status, string]> = {
  "/ai-influencer": ["built", "AI Influencer app"], "/ai-influencer-studio": ["built", "AI Influencer app"], "/character": ["built", "Cinema Studio"],
  "/ai-motion-design": ["built", "Mixed Media → Motion Design"], "/mixed-media-intro": ["built", "Mixed Media category (33 styles)"],
  "/wan-2.6": ["built", "Wan 2.6 model"], "/grok-imagine-1.5": ["built", "Grok Imagine 1.5 model"], "/minimax/h3": ["built", "MiniMax H3 model"], "/gemini-omni-flash": ["built", "Gemini Omni Flash model"],
  "/soul": ["built", "Soul app"], "/soul-intro": ["built", "Soul app"],
  "/higgsfield-layers": ["built", "Edit Image, Relight, Remove BG, Upscale"], "/marketing-automation": ["built", "Click to Ad + Ads & Products apps"], "/marketing-studio-intro": ["built", "Click to Ad, UGC Ad, Ads & Products"],
  "/remove-object-from-video": ["built", "Remove Object from Video"], "/remove-text-from-video": ["built", "Remove Text from Video"], "/ai-video-background-changer": ["built", "Video Background Changer"],
  "/ai-long-video-generator": ["built", "Script to Video + Join Clips"], "/script-to-video": ["built", "Script to Video"], "/url-to-video": ["built", "URL to Video"], "/explainer-intro": ["built", "Explainer app"],
  "/ai-video-translator": ["built", "AI Video Translator"], "/ai-voice-changer": ["built", "AI Voice Changer"], "/ai-clothes-changer": ["built", "AI Clothes Changer"], "/ai-hairstyle-changer": ["built", "AI Hairstyle Changer"],
  "/sora-2": ["ignored", "Not available on Kie.ai"], "/recraft-v4-styles": ["ignored", "Not available on Kie.ai (use Soul presets)"],
  "/voice-cloning": ["ignored", "Kie.ai has no voice-cloning speech model"], "/supercomputer-intro": ["ignored", "Agent chat; use Script to Video / URL to Video"],
  "/app-builder-intro": ["ignored", "Builds software, not media"], "/games-intro": ["ignored", "Builds games, not media"],
};
const built = new Set(APPS.map((a) => a.id));
const nice = (slug: string) =>
  slug.replace(/-(exported|seedance-2)$/, "").split(/[-/]/).filter(Boolean).map((w) => (w.length <= 3 && /\d|ai|ugc|asmr|gpt|3d/i.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(" ");

function classify(kind: Tracked["kind"], path: string): { name: string; status: Status; note?: string } | undefined {
  if (LOCALE.test(path) || NOISE.test(path)) return;
  if (KNOWN[path]) return { name: path === "/gpt-2" ? "GPT Image 2" : nice(path.replace(/-intro$/, "")), status: KNOWN[path][0], note: KNOWN[path][1] };
  if (kind === "App") {
    const slug = path.replace(/^\/apps\//, "");
    if (APP_CATEGORIES.test(slug)) return;
    return { name: nice(slug), status: built.has(ALIASES[slug] ?? slug) ? "built" : "todo" };
  }
  if (kind === "Effect") {
    const slug = path.replace(/^\/effects\/examples\//, "").replace(/-(exported|seedance-2)$/, "");
    return { name: nice(slug), status: built.has(`fx-${ALIASES[slug] ?? slug}`) ? "built" : "todo" };
  }
  return { name: path === "/gpt-2" ? "GPT Image 2" : nice(path.replace(/-intro$/, "")), status: BUILT_PAGES.has(path) ? "built" : PRODUCTS.test(path) ? "todo" : "ignored" };
}

async function scan(prev: Upcoming): Promise<Upcoming> {
  const firstScan = !Object.keys(prev.items).length;
  const items = { ...prev.items };
  // Items still waiting to be built get re-checked (they may exist in Higgsview now).
  for (const [path, t] of Object.entries(items))
    if (t.status === "todo" || t.status === "new") {
      const c = classify(t.kind, path);
      if (c && c.status !== "todo") items[path] = { ...t, status: c.status, note: c.note };
    }
  for (const [kind, sitemap] of SITEMAPS) {
    const xml = await fetch(sitemap, { headers: { "User-Agent": "Mozilla/5.0 (Higgsview feature tracker)" }, cache: "no-store" }).then((r) => r.text());
    for (const url of xml.match(/<loc>[^<]+<\/loc>/g) ?? []) {
      const full = url.slice(5, -6);
      const path = new URL(full).pathname.replace(/\/$/, "") || "/";
      if (items[path]) continue;
      const c = classify(kind, path);
      if (!c) continue;
      // After the first scan, anything unseen is news (unless it's already built or plain noise).
      const status = !firstScan && c.status !== "built" ? "new" : c.status;
      items[path] = { name: c.name, kind, url: full, firstSeen: Date.now(), status, note: c.note };
    }
  }
  return { checkedAt: Date.now(), items };
}

// Returns the tracker, re-scanning Higgsfield at most once a day (or when forced).
export async function getUpcoming(force = false): Promise<Upcoming> {
  const { data } = await readJson<Upcoming>(PATH, EMPTY);
  if (!force && Date.now() - data.checkedAt < DAY) return data;
  try {
    const fresh = await scan(data);
    return mutateJson<Upcoming>(PATH, EMPTY, (cur) => ({ ...fresh, items: { ...cur.items, ...fresh.items } })); // the scan started from `data`, so it wins
  } catch (e) {
    return mutateJson<Upcoming>(PATH, EMPTY, (cur) => ({ ...cur, checkedAt: Date.now(), error: `Scan failed: ${(e as Error).message}` }));
  }
}

export const setStatus = (path: string, status: Status) =>
  mutateJson<Upcoming>(PATH, EMPTY, (cur) => (cur.items[path] ? { ...cur, items: { ...cur.items, [path]: { ...cur.items[path], status } } } : cur));
