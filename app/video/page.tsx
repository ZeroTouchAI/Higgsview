import { Suspense } from "react";
import Workspace from "@/components/Workspace";

export default function VideoPage() {
  return <Suspense><Workspace kind="video" /></Suspense>;
}
