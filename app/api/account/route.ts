import { readProfile, saveProfile, type Profile } from "@/lib/auth";

// GET/POST the owner's profile (name, username, email) — shown in the account menu.
export async function GET() {
  return Response.json(await readProfile());
}

export async function POST(req: Request) {
  const p = (await req.json()) as Profile;
  const clean = Object.fromEntries((["firstName", "lastName", "username", "email"] as const).map((k) => [k, String(p[k] ?? "").trim().slice(0, 80)]));
  return Response.json(await saveProfile(clean));
}
