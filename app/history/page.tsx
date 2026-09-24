"use client";
import Feed from "@/components/Feed";
import { useHistory } from "@/lib/history";

export default function HistoryPage() {
  const items = useHistory();
  const spent = items.reduce((s, i) => s + (i.usd ?? 0), 0);
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-black uppercase">History</h1>
        <p className="text-sm text-muted">{items.length} generations · ${spent.toFixed(2)} spent</p>
      </div>
      <Feed items={items} kind="video" />
    </div>
  );
}
