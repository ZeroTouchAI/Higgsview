import { kie } from "@/lib/kie";

// Poll a Kie task. state: waiting | queuing | generating | success | fail
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  try {
    const d = await kie(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(id)}`);
    const urls: string[] = d.resultJson ? JSON.parse(d.resultJson).resultUrls ?? [] : [];
    return Response.json({
      state: d.state,
      url: urls[0],
      error: d.failMsg,
      usd: d.creditsConsumed != null ? d.creditsConsumed * 0.005 : undefined, // 1 Kie credit = $0.005
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
