"use client";
import { useEffect, useState } from "react";
import type { AppInput } from "@/lib/apps";
import type { Params } from "@/lib/models";

// History lives server-side (Vercel Blob, see lib/store.ts) so every device sees the same list.
export type Item = {
  id: string;
  kind: "video" | "image" | "audio" | "text";
  modelId: string;
  modelName: string;
  prompt: string;
  taskId?: string;
  url?: string;
  lastFrame?: string; // Seedance returns its final frame: used by "Continue" to chain clips
  state: "pending" | "success" | "fail";
  error?: string;
  usd?: number;
  driveLink?: string; // set after "Export to Drive"
  driveFolder?: { link: string; name: string }; // the Drive folder it was saved in
  app?: { id: string; input: AppInput; step: number; notes?: string }; // multi-step App progress (notes = text from earlier steps)
  text?: string; // text result (analysis, storyboard, transcript)
  group?: string; // items made together (script scenes, long-video parts); Feed offers "Join"
  params?: Params; // exact settings of a studio generation (used by "Regenerate")
  next?: { video: string; label: string }; // split video: the next part starts when this one finishes, with its last frame as an extra reference
  hidden?: boolean; // "deleted" from History but kept so Spending stays accurate
  createdAt: number;
};

// One shared copy for every component on the page.
let cache: Item[] = [];
const listeners = new Set<(items: Item[]) => void>();
const publish = (items: Item[]) => { cache = items; listeners.forEach((l) => l(items)); };
const load = async (r: Promise<Response>) => { const res = await r; if (res.ok) publish(await res.json()); };

export const refreshHistory = () => load(fetch("/api/history"));
export const removeItem = (id: string) => load(fetch(`/api/history?id=${id}`, { method: "DELETE" }));

// One-time: move history saved by the old per-browser version up to the server.
async function migrate() {
  let old: Item[] = [];
  try { old = JSON.parse(localStorage.getItem("hv_history") || "[]"); } catch {}
  if (!old.length) return;
  const res = await fetch("/api/history", { method: "POST", body: JSON.stringify(old) });
  if (res.ok) { try { localStorage.removeItem("hv_history"); } catch {} }
}

export function useHistory(includeHidden = false) {
  const [items, setItems] = useState(cache);
  useEffect(() => {
    listeners.add(setItems);
    migrate().finally(refreshHistory);
    return () => { listeners.delete(setItems); };
  }, []);
  // While anything renders, poll: the server checks Kie and saves results.
  const pending = items.some((i) => i.state === "pending");
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(refreshHistory, 5000);
    return () => clearInterval(t);
  }, [pending]);
  return includeHidden ? items : items.filter((i) => !i.hidden);
}
