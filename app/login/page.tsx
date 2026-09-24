"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/login", { method: "POST", body: JSON.stringify({ password: pw }) });
    if (r.ok) { router.replace("/"); router.refresh(); }
    else setErr("Wrong password");
  }
  return (
    <form onSubmit={submit} className="m-auto mt-40 flex w-80 flex-col gap-3 rounded-2xl bg-panel p-6">
      <h1 className="text-2xl font-black uppercase">Higgsview</h1>
      <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" aria-label="Password"
        className="rounded-xl bg-chip px-4 py-3 outline-none focus:ring-2 focus:ring-lime" />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button className="rounded-xl bg-lime py-3 font-bold text-black">Log in</button>
    </form>
  );
}
