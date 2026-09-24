import { Suspense } from "react";
import Workspace from "@/components/Workspace";

// Keyed by the query string so picking another model/tab from the nav menu starts fresh.
export default async function VideoPage({ searchParams }: PageProps<"/video">) {
  return <Suspense><Workspace key={JSON.stringify(await searchParams)} kind="video" /></Suspense>;
}
