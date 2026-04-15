"use client";

import { usePathname } from "next/navigation";
import TopBar from "./TopBar";

export default function ConditionalTopBar() {
  const pathname = usePathname();

  // Skjul navigasjonsmenyen på kart-siden
  if (pathname && pathname.startsWith("/map")) {
    return null;
  }

  return <TopBar />;
}
