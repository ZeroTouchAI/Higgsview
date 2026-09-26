// Sign-in with Google. /api/login verifies Google's ID token and sets `hv_session` = base64url(user).HMAC,
// signed with env SESSION_SECRET. Everything a user makes lives under users/<sub>/ in Blob (see lib/store.ts).
import { createHmac, timingSafeEqual } from "node:crypto";
import { readJson, mutateJson } from "@/lib/store";

export type User = { sub: string; email: string; name?: string; picture?: string };

const mac = (b: string) => createHmac("sha256", process.env.SESSION_SECRET ?? "").update(b).digest("base64url");
export const signSession = (u: User) => {
  const b = Buffer.from(JSON.stringify(u)).toString("base64url");
  return `${b}.${mac(b)}`;
};
export function verifySession(v?: string): User | undefined {
  const [b, m] = v?.split(".") ?? [];
  if (!b || !m || !process.env.SESSION_SECRET) return;
  const want = mac(b);
  if (m.length !== want.length || !timingSafeEqual(Buffer.from(m), Buffer.from(want))) return;
  try { return JSON.parse(Buffer.from(b, "base64url").toString()); } catch { return; }
}
export const sessionCookie = (v: string, maxAge = 60 * 60 * 24 * 90) => `hv_session=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

// The signed-in user of the current request (route handlers only).
export async function currentUser() {
  const { cookies } = await import("next/headers");
  return verifySession((await cookies()).get("hv_session")?.value);
}
export async function userDir() {
  const u = await currentUser();
  if (!u) throw new Error("Not signed in");
  return `users/${u.sub}/`;
}
// The owner (env OWNER_EMAIL) may use the server's own KIE_API_KEY; everyone else brings their own key.
export const isOwner = (u?: User) => !!u && !!process.env.OWNER_EMAIL && u.email.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase();

export type Profile = { firstName?: string; lastName?: string; email?: string; picture?: string };
export async function readProfile(): Promise<Profile> {
  const u = await currentUser();
  const [first, ...rest] = (u?.name ?? "").split(" ");
  const saved = (await readJson<Profile>(`${await userDir()}profile.json`, {})).data;
  return { firstName: first || undefined, lastName: rest.join(" ") || undefined, ...saved, email: u?.email, picture: u?.picture };
}
export const saveProfile = async (p: Profile) => mutateJson<Profile>(`${await userDir()}profile.json`, {}, () => p);
