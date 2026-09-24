// Single-user password gate. The password starts as env APP_PASSWORD; "Change password" (Profile page) stores a
// replacement hash in Blob (auth.json), which then wins. The login cookie holds the hash of the current password,
// so changing it logs out every other browser.
import { readJson, mutateJson } from "@/lib/store";

export async function hash(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("higgsview:" + s));
  return Buffer.from(buf).toString("hex");
}

let cached: { value?: string; at: number } = { at: 0 };

// Hash the login cookie must equal; undefined = no password configured (open, e.g. local dev).
export async function activeHash(): Promise<string | undefined> {
  if (Date.now() - cached.at < 60_000) return cached.value; // ponytail: 60s per-instance cache; other instances see a new password within a minute
  const { data } = await readJson<{ hash?: string }>("auth.json", {}).catch(() => ({ data: {} as { hash?: string } }));
  const env = process.env.APP_PASSWORD;
  cached = { value: data.hash ?? (env ? await hash(env) : undefined), at: Date.now() };
  return cached.value;
}

export async function setPassword(next: string) {
  const h = await hash(next);
  await mutateJson<{ hash?: string }>("auth.json", {}, () => ({ hash: h }));
  cached = { value: h, at: Date.now() };
  return h;
}

export const authCookie = (h: string) => `hv_auth=${h}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 90}`;

export type Profile = { firstName?: string; lastName?: string; username?: string; email?: string };
export const readProfile = async () => (await readJson<Profile>("profile.json", {})).data;
export const saveProfile = (p: Profile) => mutateJson<Profile>("profile.json", {}, () => p);
