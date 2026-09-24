"use client";
import { useCallback, useEffect, useState } from "react";

// Generation history, kept in this browser's localStorage (single-user app).
// ponytail: Kie result URLs expire (~14 days). Download keepers, or add Google Drive/Vercel Blob sync when it matters.
export type Item = {
  id: string;
  kind: "video" | "image";
  modelId: string;
  modelName: string;
  prompt: string;
  taskId?: string;
  url?: string;
  state: "pending" | "success" | "fail";
  error?: string;
  usd?: number;
  driveLink?: string; // set after "Export to Drive"
  createdAt: number;
};

const KEY = "hv_history";
const read = (): Item[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};
const write = (items: Item[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  window.dispatchEvent(new Event("hv_history"));
};

export function useHistory() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    window.addEventListener("hv_history", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("hv_history", sync); window.removeEventListener("storage", sync); };
  }, []);

  const update = useCallback((id: string, patch: Partial<Item>) => write(read().map((i) => (i.id === id ? { ...i, ...patch } : i))), []);
  const add = useCallback((item: Omit<Item, "createdAt">) => write([{ ...item, createdAt: Date.now() }, ...read()]), []);
  const remove = useCallback((id: string) => write(read().filter((i) => i.id !== id)), []);

  // Poll pending Kie tasks every 5s.
  const pending = items.filter((i) => i.state === "pending" && i.taskId).map((i) => i.id + i.taskId).join();
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(async () => {
      for (const i of read().filter((i) => i.state === "pending" && i.taskId)) {
        const d = await fetch(`/api/task?id=${i.taskId}`).then((r) => r.json()).catch(() => null);
        if (d?.state === "success") update(i.id, { state: "success", url: d.url, usd: d.usd });
        else if (d?.state === "fail") update(i.id, { state: "fail", error: d.error || "Generation failed" });
      }
    }, 5000);
    return () => clearInterval(t);
  }, [pending, update]);

  return { items, add, update, remove };
}
