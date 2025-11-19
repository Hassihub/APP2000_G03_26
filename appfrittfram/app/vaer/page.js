"use client";
import { useState } from "react";  // ← import useState
import Link from "next/link";

export default function Weather() {

  const YR_BASE_URL = "https://www.yr.no/nb/innhold/";
  const YR_METEOGRAM_SUFFIX = "/meteogram.svg";


const [locationId, setLocationId] = useState("1-43228");

const handleChange = (id) => {
  setLocationId(id);
  console.log("location changed");
};

const meteogramUrl = `${YR_BASE_URL}${locationId}${YR_METEOGRAM_SUFFIX}`;

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

        <div className="root">
          <div className="box">
      <h1>Vær</h1>
            <div className="buttons">
              <button className="knapp" onClick={() => handleChange("1-43228")}>Bø</button>
              <button className="knapp" onClick={() => handleChange("1-72837")}>Oslo</button>
              <button className="knapp" onClick={() => handleChange("1-2376")}>Kristiansand</button>
              <input className="w-search" type="text" placeholder="Search.."></input>
            </div>
            <div className="weather-embed">
              <img src={meteogramUrl} alt="blablabla" />
            </div>
          </div>
        </div>
    </div>
  );
}
