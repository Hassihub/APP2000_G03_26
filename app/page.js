"use client";
<<<<<<< HEAD
=======
import { useEffect, useState } from "react";
>>>>>>> parent of e7135d2 (Merge branch 'MariusMain')
import Image from "next/image";
import Link from "next/link";

export default function Home() {
<<<<<<< HEAD
  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>



      <main style={{ padding: 0 }}>
        <div className="box-container">
          <Link href="/utforsk" className="info-box">
=======
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) setIsLoggedIn(true);
        }
      } catch {
        // ignore, show buttons as logged out
      } finally {
        setCheckedAuth(true);
      }
    };

    checkAuth();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      <main style={{ padding: 0 }}>
        <div className="box-container">
          <Link href="/explore" className="info-box">
>>>>>>> parent of e7135d2 (Merge branch 'MariusMain')
            <Image
              src="/images/Explore.jpg"
              alt="Utforsk"
              fill
              sizes="(max-width:600px) 100vw, (max-width:1200px) 50vw, 20vw"
              style={{
                objectFit: "cover",
                objectPosition: "center",
                pointerEvents: "none",
              }}
            />
            <span>Utforsk</span>
<<<<<<< HEAD
=======
            <p>Utforsk diverse turer og hytter.</p>
>>>>>>> parent of e7135d2 (Merge branch 'MariusMain')
          </Link>

          <Link href="/reserver" className="info-box">
            <Image
              src="/images/Reserve.jpg"
              alt="Reserver"
              fill
              sizes="(max-width:600px) 100vw, (max-width:1200px) 50vw, 20vw"
              style={{
                objectFit: "cover",
                objectPosition: "center",
                pointerEvents: "none",
              }}
            />
            <span>Reserver</span>
<<<<<<< HEAD
=======
            <p>Reserver hytter over helle Utopia.</p>
>>>>>>> parent of e7135d2 (Merge branch 'MariusMain')
          </Link>

          <Link href="/map" className="info-box">
            <Image
              src="/images/Map.jpg"
              alt="Kart"
              fill
              sizes="(max-width:600px) 100vw, (max-width:1200px) 50vw, 20vw"
              style={{
                objectFit: "cover",
                objectPosition: "center",
                pointerEvents: "none",
              }}
            />
            <span>Kart</span>
<<<<<<< HEAD
=======
            <p>Utforsk Utopia sinne stier og hytter via vårt kart!</p>
>>>>>>> parent of e7135d2 (Merge branch 'MariusMain')
          </Link>

          <Link href="/vaer" className="info-box">
            <Image
              src="/images/Weather.jpg"
              alt="Vær"
              fill
              sizes="(max-width:600px) 100vw, (max-width:1200px) 50vw, 20vw"
              style={{
                objectFit: "cover",
                objectPosition: "center",
                pointerEvents: "none",
              }}
            />
            <span>Vær</span>
<<<<<<< HEAD
=======
            <p>Sjekk ut været der du vil reise.</p>
>>>>>>> parent of e7135d2 (Merge branch 'MariusMain')
          </Link>

          <Link href="/sosial" className="info-box">
            <Image
              src="/images/Social.jpg"
              alt="Sosial"
              fill
              sizes="(max-width:600px) 100vw, (max-width:1200px) 50vw, 20vw"
              style={{
                objectFit: "cover",
                objectPosition: "center",
                pointerEvents: "none",
              }}
            />
            <span>Sosial</span>
<<<<<<< HEAD
          </Link>

          {/* Ny boks for Registrer / Sign Up */}
          <Link href="/signup" className="info-box">
            <Image
              src="/images/Register.jpg" // legg til et passende bilde
              alt="Registrer"
              fill
              sizes="(max-width:600px) 100vw, (max-width:1200px) 50vw, 20vw"
              style={{ objectFit: "cover", objectPosition: "center", pointerEvents: "none" }}
            />
            <span>Registrer</span>
          </Link>
        </div>

        <footer className="footer">
          Dette er en footer som ligger over bildene
        </footer>
=======
            <p>
              Snakk med dinne venner og grupper.
              <br />
              Planlegg turer med dine nære.
            </p>
          </Link>
        </div>
>>>>>>> parent of e7135d2 (Merge branch 'MariusMain')
      </main>
    </div>
  );
}
