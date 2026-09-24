// Server-only Kie.ai client. The API key never reaches the browser.
const BASE = "https://api.kie.ai";

export async function kie(path: string, init: RequestInit = {}) {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY is not set. See README → API keys.");
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
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY is not set.");
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
