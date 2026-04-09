"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FiSettings,
  FiSearch,
  FiMenu,
  FiChevronLeft,
  FiUser,
  FiLogIn,
  FiLogOut,
} from "react-icons/fi";
import { useLanguage, useTranslations } from "./LanguageProvider";

const flags = { no: "\u{1F1F3}\u{1F1F4}", en: "\u{1F1EC}\u{1F1E7}", fr: "\u{1F1EB}\u{1F1F7}", es: "\u{1F1EA}\u{1F1F8}", it: "\u{1F1EE}\u{1F1F9}" };

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const scrollPositionRef = useRef(0);
  const { language, setLanguage, languages } = useLanguage();
  const translations = useTranslations("topBar");

  const router = useRouter();
  const pathname = usePathname();

  const pages = useMemo(
    () => [
      { nameKey: "home", href: "/" },
      { nameKey: "explore", href: "/explore" },
      { nameKey: "reserve", href: "/reserver" },
      { nameKey: "map", href: "/map" },
      { nameKey: "weather", href: "/vaer" },
      { nameKey: "social", href: "/sosial" },
      { nameKey: "ads", href: "/annonser" },
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setCurrentUser(res.ok ? data.user || null : null);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
        }
      }
    }

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Load profile image when user is known
  useEffect(() => {
    if (!currentUser) { setProfileImage(null); return; }
    let cancelled = false;
    fetch("/api/profile", { credentials: "include", cache: "no-store" })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => { if (!cancelled) setProfileImage(d?.profile?.profileImage || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlOverscrollBehavior = documentElement.style.overscrollBehavior;

    if (open) {
      scrollPositionRef.current = window.scrollY;
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${scrollPositionRef.current}px`;
      body.style.width = "100%";
      documentElement.style.overflow = "hidden";
      documentElement.style.overscrollBehavior = "none";
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;

      if (open) {
        window.scrollTo(0, scrollPositionRef.current);
      }
    };
  }, [open]);

  const quickActions = useMemo(() => {
    const items = [
      {
        key: "profile",
        label: translations.profile,
        icon: <FiUser size={16} />,
        action: () => router.push(currentUser ? "/profile" : "/login"),
      },
      {
        key: "settings",
        label: translations.settings,
        icon: <FiSettings size={16} />,
        action: () => router.push("/settings"),
      },
    ];

    if (currentUser) {
      items.push({
        key: "logout",
        label: translations.logout,
        icon: <FiLogOut size={16} />,
        action: async () => {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
          }).catch(() => {});
          setCurrentUser(null);
          router.push("/login");
        },
      });
    } else {
      items.push({
        key: "login",
        label: translations.login,
        icon: <FiLogIn size={16} />,
        action: () => router.push("/login"),
      });
    }

    return items;
  }, [currentUser, router, translations]);

  return (
    <header
      style={{
        width: "100%",
        maxWidth: "100vw",
        overflowX: "hidden",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        backgroundColor: "var(--nav-bg)",
        borderBottom: "1px solid var(--nav-border)",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        boxSizing: "border-box",
        transition: "background-color 0.25s ease",
      }}
    >
      {/* Left: Logo */}
      <Link
        href="/"
        onClick={(e) => {
          if (pathname === "/") {
            e.preventDefault();
            document.getElementById("hero-section")?.scrollIntoView({ behavior: "smooth" });
          }
        }}
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}
      >
        <svg viewBox="0 0 48 32" width="44" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 30 L16 5 L24 17 L30 9 L46 30 Z" fill="var(--nav-text)" />
          <circle cx="36" cy="7" r="3.5" fill="#f59e0b" />
        </svg>
        <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--nav-text)", letterSpacing: "-0.02em" }}>
          FrittFram
        </span>
      </Link>

      {/* Right: Hamburger + profile avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", position: "relative" }}>

        {/* Search icon */}
        <Link href="/search" style={{ display: "flex", alignItems: "center", textDecoration: "none", color: "var(--nav-icon)" }}>
          <FiSearch size={22} />
        </Link>

        {/* Profile avatar / icon */}
        <Link href={currentUser ? "/profile" : "/login"} style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          {profileImage ? (
            <Image
              src={profileImage}
              alt="Profil"
              width={32}
              height={32}
              unoptimized
              style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid #e5e7eb" }}
            />
          ) : (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-input)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FiUser size={16} color="#6b7280" />
            </div>
          )}
        </Link>

        {/* Hamburger */}
        <div style={{ position: "relative" }}>
          <FiMenu
            size={28}
            style={{ cursor: "pointer", color: "var(--nav-icon)" }}
            onClick={() => setOpen(!open)}
          />

          {open && (
            <>
              <div
                onClick={() => setOpen(false)}
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  zIndex: 1500,
                }}
              />

              <div
                style={{
                  position: "fixed",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: "360px",
                  backgroundColor: "var(--nav-drawer)",
                  borderLeft: "1px solid var(--nav-drawer-border)",
                  boxShadow: "-5px 0 15px rgba(0,0,0,0.2)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  zIndex: 2000,
                  overflowY: "auto",
                  overscrollBehavior: "contain",
                  color: "var(--nav-text)",
                  fontFamily: "Poppins, sans-serif",
                }}
              >
                {/* Header */}
                <div style={{ padding: "1.5rem 2rem", display: "flex", alignItems: "center", gap: "1rem", borderBottom: "1px solid var(--nav-drawer-border)" }}>
                  <FiChevronLeft
                    size={26}
                    style={{ cursor: "pointer", color: "var(--nav-icon)" }}
                    onClick={() => setOpen(false)}
                  />
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "var(--nav-text)" }}>
                    {translations.navigate}
                  </h2>
                </div>

                <div style={{ display: "grid", gap: "1.5rem", padding: "1.5rem 2rem 2rem", flex: 1 }}>
                  {/* Account card */}
                  <Link
                    href={currentUser ? "/profile" : "/login"}
                    onClick={() => setOpen(false)}
                    style={{
                      padding: "1rem",
                      borderRadius: "14px",
                      background: "var(--nav-drawer-card)",
                      border: "1px solid var(--nav-drawer-border)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.85rem",
                    }}
                  >
                    {profileImage ? (
                      <Image
                        src={profileImage}
                        alt="Profil"
                        width={44}
                        height={44}
                        unoptimized
                        style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid #3d4460", flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FiUser size={20} color="var(--nav-icon)" />
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--nav-muted)", marginBottom: "0.2rem" }}>
                        {translations.account}
                      </div>
                      <div style={{ fontWeight: 700, color: "var(--nav-text)", fontSize: "0.95rem" }}>
                        {currentUser?.username || currentUser?.email || translations.guest}
                      </div>
                      <div style={{ color: "var(--nav-muted)", fontSize: "0.82rem" }}>
                        {currentUser?.email
                          ? `${translations.signedInAs} ${currentUser.email}`
                          : translations.guest}
                      </div>
                    </div>
                  </Link>

                  {/* Navigation links */}
                  <section>
                    <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--nav-muted)", marginBottom: "0.75rem" }}>
                      {translations.navigate}
                    </div>
                    <div style={{ display: "grid", gap: "0.45rem" }}>
                      {pages.map((p) => {
                        const isActive = p.href === "/" ? pathname === "/" : pathname?.startsWith(p.href);
                        return (
                          <Link
                            key={p.nameKey}
                            href={p.href}
                            onClick={(e) => {
                              setOpen(false);
                              if (p.href === "/" && pathname === "/") {
                                e.preventDefault();
                                document.getElementById("hero-section")?.scrollIntoView({ behavior: "smooth" });
                              }
                            }}
                            style={{
                              padding: "0.8rem 1rem",
                              textDecoration: "none",
                              color: isActive ? "var(--nav-text)" : "var(--nav-icon)",
                              fontWeight: isActive ? 700 : 500,
                              borderRadius: "10px",
                              background: isActive ? "var(--nav-active-bg)" : "transparent",
                              border: `1px solid ${isActive ? "var(--nav-active-border)" : "transparent"}`,
                              fontSize: "0.92rem",
                            }}
                          >
                            {translations[p.nameKey]}
                          </Link>
                        );
                      })}
                    </div>
                  </section>

                  {/* Quick actions */}
                  <section>
                    <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--nav-muted)", marginBottom: "0.75rem" }}>
                      {translations.quickActions}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                      {quickActions.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => { setOpen(false); item.action(); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            justifyContent: "center",
                            padding: "0.8rem",
                            borderRadius: "10px",
                            border: "1px solid var(--nav-drawer-border)",
                            background: "var(--nav-drawer-card)",
                            color: "var(--nav-text)",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            fontFamily: "inherit",
                          }}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Language picker at bottom */}
                <div style={{ padding: "1.25rem 2rem", borderTop: "1px solid var(--nav-drawer-border)" }}>
                  <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--nav-muted)", marginBottom: "0.6rem" }}>
                    {translations.language}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {languages.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        style={{
                          padding: "0.45rem 0.7rem",
                          borderRadius: "8px",
                          border: language === lang ? "2px solid var(--accent)" : "1px solid var(--nav-drawer-border)",
                          background: language === lang ? "var(--nav-drawer-card)" : "transparent",
                          cursor: "pointer",
                          fontSize: "1.1rem",
                        }}
                      >
                        {flags[lang]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
