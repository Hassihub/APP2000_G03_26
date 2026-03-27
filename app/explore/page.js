import { Suspense } from "react";
import ExplorePage from "./ExplorePage";

export default function Page() {
  return (
    <Suspense fallback={<div>Laster...</div>}>
      <ExplorePage />
    </Suspense>
  );
}