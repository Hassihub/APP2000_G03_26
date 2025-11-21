"use client";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      <header className="topbar">
  <span className="topbar-left-text">Dette er et skoleprosjekt</span>
  <nav className="topbar-nav">
    <Link className="topbar-item" href="/">Home</Link>
    <Link className="topbar-item" href="/search">Search</Link>
    <Link className="topbar-item" href="/settings">Settings</Link>
    <Link className="topbar-item" href="/profile">Profile</Link>
  </nav>
</header>


      <main style={{ padding: 0 }}>
        <div className="box-container">
          <Link href="/utforsk" className="info-box">
            <Image
              src="/images/Explore.jpg"
              alt="Utforsk"
              fill
              sizes="(max-width:600px) 100vw, (max-width:1200px) 50vw, 20vw"
              style={{ objectFit: "cover", objectPosition: "center", pointerEvents: "none" }}
            />
            <span>Utforsk</span>
          </Link>

          <Link href="/reserver" className="info-box">
            <Image
              src="/images/Reserve.jpg"
              alt="Reserver"
              fill
              sizes="(max-width:600px) 100vw, (max-width:1200px) 50vw, 20vw"
              style={{ objectFit: "cover", objectPosition: "center", pointerEvents: "none" }}
            />
            <span>Reserver</span>
          </Link>

          <Link href="/kart" className="info-box">
            <Image
              src="/images/Map.jpg"
              alt="Kart"
              fill
              sizes="(max-width:600px) 100vw, (max-width:1200px) 50vw, 20vw"
              style={{ objectFit: "cover", objectPosition: "center", pointerEvents: "none" }}
            />
            <span>Kart</span>
          </Link>

          <Link href="/vaer" className="info-box">
            <Image
              src="/images/Weather.jpg"
              alt="Vær"
              fill
              sizes="(max-width:600px) 100vw, (max-width:1200px) 50vw, 20vw"
              style={{ objectFit: "cover", objectPosition: "center", pointerEvents: "none" }}
            />
            <span>Vær</span>
          </Link>

          <Link href="/sosial" className="info-box">
            <Image
              src="/images/Social.jpg"
              alt="Sosial"
              fill
              sizes="(max-width:600px) 100vw, (max-width:1200px) 50vw, 20vw"
              style={{ objectFit: "cover", objectPosition: "center", pointerEvents: "none" }}
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
