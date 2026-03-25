import { Suspense } from "react";
import BookingClient from "./BookingClient";

export default function BookingPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem" }}>Laster booking...</div>}>
      <BookingClient />
    </Suspense>
  );
}
