// Server-only Kie.ai client. Each user's Kie key lives only in their browser and comes with every request as
// the x-kie-key header; it's used for that request and never stored. The owner (OWNER_EMAIL) may fall back to env KIE_API_KEY.
import { currentUser, isOwner } from "@/lib/auth";
const BASE = "https://api.kie.ai";

async function apiKey() {
  const { headers } = await import("next/headers");
  const k = (await headers()).get("x-kie-key")?.trim();
  if (k) return k;
  if (process.env.KIE_API_KEY && isOwner(await currentUser())) return process.env.KIE_API_KEY;
  throw new Error("Add your Kie.ai API key first (account menu → Kie.ai API key).");
}

export async function kie(path: string, init: RequestInit = {}) {
  const key = await apiKey();
  const res = await fetch((path.startsWith("http") ? "" : BASE) + path, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init.headers },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({ code: res.status, msg: res.statusText }));
  if (json.code !== 200) throw new Error(json.msg || `Kie error ${json.code}`);
  return json.data;
}

// Text/vision AI through Kie (Gemini 3.7 Flash, OpenAI-compatible). `media` = image, video, audio or PDF URLs,
// which Gemini reads directly (all sent as `image_url` parts, per Kie's docs).
export async function chat(prompt: string, media: string[] = []): Promise<string> {
  const key = await apiKey();
  const res = await fetch(`${BASE}/gemini-3-7-flash-openai/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      stream: false,
      reasoning_effort: "low",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...media.map((url) => ({ type: "image_url", image_url: { url } }))] }],
    }),
    cache: "no-store",
  });
  const json = await res.json().catch(async () => ({ error: { message: `${res.status} ${(await res.text()).slice(0, 200)}` } }));
  const text = json.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error(json.error?.message || json.msg || "Text AI returned nothing");
  return text.trim();
}
