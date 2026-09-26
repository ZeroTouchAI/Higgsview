import { readProfile, saveProfile, type Profile } from "@/lib/auth";

// GET/POST the signed-in user's profile (first/last name, which set the initials; email and photo come from Google) — shown in the account menu.
export async function GET() {
  return Response.json(await readProfile());
}

export async function POST(req: Request) {
  const p = (await req.json()) as Profile;
  const clean = Object.fromEntries((["firstName", "lastName"] as const).map((k) => [k, String(p[k] ?? "").trim().slice(0, 80)]));
  return Response.json(await saveProfile(clean));
}
