import { Suspense } from "react";
import Workspace from "@/components/Workspace";

export default function ImagePage() {
  return <Suspense><Workspace kind="image" /></Suspense>;
}
