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
