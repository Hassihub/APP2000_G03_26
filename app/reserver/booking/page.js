// Laget av Sigurd

import { Suspense } from "react";
import BookingClient from "./BookingClient";

export default function BookingPage() {
  // Wrapper booking-klienten i Suspense slik at query-parametere kan lastes trygt.
  return (
    <Suspense
      fallback={<div style={{ padding: "2rem" }}>Laster booking...</div>}
    >
      <BookingClient />
    </Suspense>
  );
}