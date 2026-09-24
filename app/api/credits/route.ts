import { kie } from "@/lib/kie";

export async function GET() {
  try {
    const credits = await kie("/api/v1/chat/credit");
    return Response.json({ credits, usd: credits * 0.005 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
