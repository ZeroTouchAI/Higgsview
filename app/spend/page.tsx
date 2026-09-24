"use client";
import { useEffect, useState } from "react";
import { useHistory, type Item } from "@/lib/history";

const usd = (n: number) => `$${n.toFixed(2)}`;
const dayKey = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Group paid items by a label and sort by spend.
function breakdown(items: Item[], label: (i: Item) => string) {
  const m = new Map<string, { usd: number; n: number }>();
  for (const i of items) {
    const k = label(i);
    const e = m.get(k) ?? { usd: 0, n: 0 };
    m.set(k, { usd: e.usd + (i.usd ?? 0), n: e.n + 1 });
  }
  return [...m].sort((a, b) => b[1].usd - a[1].usd);
}

function Bars({ title, rows }: { title: string; rows: [string, { usd: number; n: number }][] }) {
  const max = Math.max(...rows.map(([, v]) => v.usd), 0.01);
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-panel p-4">
      <h2 className="text-sm font-bold tracking-wide text-muted uppercase">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[9rem_1fr_5rem] items-center gap-3 text-sm">
          <span className="truncate" title={k}>{k}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-chip"><span className="block h-full rounded-full bg-lime" style={{ width: `${(v.usd / max) * 100}%` }} /></span>
          <span className="text-right tabular-nums">{usd(v.usd)} <span className="text-xs text-muted">×{v.n}</span></span>
        </div>
      ))}
    </section>
  );
}

export default function SpendPage() {
  const all = useHistory(true);
  const [balance, setBalance] = useState<number>();
  const [now] = useState(() => Date.now());
  useEffect(() => { fetch("/api/credits").then((r) => r.json()).then((d) => setBalance(d.usd), () => {}); }, []);

  const paid = all.filter((i) => (i.usd ?? 0) > 0);
  const total = paid.reduce((s, i) => s + (i.usd ?? 0), 0);
  const since = (days: number) => paid.filter((i) => i.createdAt > now - days * 864e5).reduce((s, i) => s + (i.usd ?? 0), 0);
  const failed = all.filter((i) => i.state === "fail").length;
  const days = Array.from({ length: 14 }, (_, n) => dayKey(now - (13 - n) * 864e5));
  const byDay = new Map(breakdown(paid, (i) => dayKey(i.createdAt)));
  const dayMax = Math.max(...days.map((d) => byDay.get(d)?.usd ?? 0), 0.01);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-3xl font-black uppercase">Spending</h1>
        <a href="https://kie.ai/billing" target="_blank" rel="noreferrer" className="rounded-lg bg-chip px-3 py-1.5 text-sm hover:bg-line">Kie.ai billing ↗</a>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Kie balance", balance != null ? usd(balance) : "…"], ["Today", usd(since(1))], ["Last 7 days", usd(since(7))], ["Last 30 days", usd(since(30))], ["All time", usd(total)]].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-panel p-4">
            <p className="text-xs font-semibold text-muted uppercase">{k}</p>
            <p className={`mt-1 text-2xl font-black tabular-nums ${k === "Kie balance" ? "text-lime" : ""}`}>{v}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl bg-panel p-4">
        <h2 className="mb-3 text-sm font-bold tracking-wide text-muted uppercase">Last 14 days</h2>
        <div className="flex h-40 items-end gap-1.5">
          {days.map((d) => {
            const v = byDay.get(d)?.usd ?? 0;
            return (
              <div key={d} className="flex flex-1 flex-col items-center gap-1" title={`${d}: ${usd(v)}`}>
                <span className="text-[10px] text-muted tabular-nums">{v ? usd(v) : ""}</span>
                <span className="w-full rounded-t bg-lime" style={{ height: `${(v / dayMax) * 100}%`, minHeight: v ? 2 : 0 }} />
                <span className="text-[10px] text-muted">{d.split(" ")[1]}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Bars title="By tool / app" rows={breakdown(paid, (i) => i.modelName)} />
        <Bars title="By type" rows={breakdown(paid, (i) => ({ video: "Video", image: "Image", audio: "Audio", text: "Text AI" })[i.kind])} />
      </div>

      <section className="overflow-x-auto rounded-2xl bg-panel p-4">
        <h2 className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">Every charge</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="py-1">When</th><th>What</th><th>Prompt</th><th className="text-right">Cost</th></tr></thead>
          <tbody>
            {paid.map((i) => (
              <tr key={i.id} className="border-t border-line/60">
                <td className="py-1.5 pr-3 whitespace-nowrap text-muted">{new Date(i.createdAt).toLocaleString()}</td>
                <td className="pr-3 whitespace-nowrap">{i.modelName}{i.hidden && <span className="ml-1 text-xs text-muted">(deleted)</span>}</td>
                <td className="max-w-md truncate pr-3 text-muted">{i.prompt}</td>
                <td className="text-right tabular-nums">{usd(i.usd ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">Failed jobs aren&apos;t charged by Kie ({failed} so far). Costs are what Kie reported per job; check the Kie billing page for the official ledger.</p>
      </section>
    </div>
  );
}
