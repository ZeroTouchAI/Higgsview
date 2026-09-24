import { redirect } from "next/navigation";

// Effects open like Higgsfield's: straight into an effect, with "Change" to browse the rest.
export default function EffectsPage() {
  redirect("/apps/fx-floating-fall");
}
