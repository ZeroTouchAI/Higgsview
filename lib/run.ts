// Start one model call. Returns a Kie taskId, or a finished url for free/direct providers.
import { kie } from "@/lib/kie";
import type { Model, Params } from "@/lib/models";

export async function runModel(m: Model, params: Params): Promise<{ taskId?: string; url?: string }> {
  const body = m.build(params);
  if ("url" in body) return { url: body.url };
  const d = await kie("/api/v1/jobs/createTask", { method: "POST", body: JSON.stringify(body) });
  return { taskId: d.taskId };
}

export function validate(m: Model, params: Params) {
  if (!params.prompt?.trim() && !m.promptOptional) return "Prompt is required";
  for (const need of m.needs ?? []) if (!params[need]) return `${m.name} needs ${m.labels?.[need] ?? need}`;
}
