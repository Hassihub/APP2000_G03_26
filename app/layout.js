import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "./components/AppShell";
import { LanguageProvider } from "./components/LanguageProvider";
import CookieBanner from "./components/CookieBanner";
// ResetBanner er en "use client"-komponent og må importeres separat.
// layout.js er en Server Component og kan ikke selv inneholde onClick eller useState.
// Ved å flytte knappen til ResetBanner.js kan den ha interaktivitet
// mens layout.js forblir en Server Component (raskere lasting).
import ResetBanner from "./components/ResetBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Fritt Fram",
  description: "En portal for turer, hytter og eventyr.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="no">
      <body style={{ margin: 0, padding: 0 }}>
        <ResetBanner />
        <LanguageProvider>
          <AppShell>{children}</AppShell>
          <CookieBanner />
        </LanguageProvider>
      </body>
    </html>
  );
}
