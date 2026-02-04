"use client";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      <main style={{ padding: 0 }}>
        <section
          style={{
            padding: "1.5rem 1rem 0.5rem",
            textAlign: "center",
          }}
        >
          <p style={{ marginBottom: "0.75rem", fontWeight: 500 }}>
            Har du konto? Logg inn eller registrer deg for å bruke profilen din.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.75rem",
            }}
          >
            <Link
              href="/login"
              style={{
                padding: "0.5rem 1.2rem",
                background: "#333",
                color: "white",
                borderRadius: "4px",
              }}
            >
              Logg inn
            </Link>
            <Link
              href="/signup"
              style={{
                padding: "0.5rem 1.2rem",
                background: "white",
                color: "#333",
                borderRadius: "4px",
                border: "1px solid #333",
              }}
            >
              Registrer deg
            </Link>
          </div>
        </section>

        <div className="box-container">
          <Link href="/explore" className="info-box">
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
          </Link>
        </div>

        <footer className="footer">
          Dette er en footer som ligger over bildene
        </footer>
      </main>
    </div>
  );
}
