"use client";
import { useEffect, useState } from "react";

// History lives server-side (Vercel Blob, see lib/store.ts) so every device sees the same list.
export type Item = {
  id: string;
  kind: "video" | "image";
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

export function useHistory() {
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
  return items;
}
