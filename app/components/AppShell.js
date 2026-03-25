"use client";

import TopBar from "./TopBar";
import { useTranslations } from "./LanguageProvider";

export default function AppShell({ children }) {
  const footer = useTranslations("footer");

  return (
    <>
      <TopBar />
      {children}
      <footer
        className="footer"
        style={{ padding: "1rem 1.5rem", textAlign: "center" }}
      >
        {footer.text}
      </footer>
    </>
  );
}