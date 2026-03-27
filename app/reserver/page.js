import { Suspense } from "react";
import ReserverClient from "./ReserverClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Laster...</div>}>
      <ReserverClient />
    </Suspense>
  );
}