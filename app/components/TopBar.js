"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FiSearch,
  FiSettings,
  FiHome,
  FiMenu,
  FiChevronLeft,
  FiUser,
  FiLogIn,
  FiLogOut,
} from "react-icons/fi";
import { useLanguage, useTranslations } from "./LanguageProvider";

const flags = { no: "🇳🇴", en: "🇬🇧", fr: "🇫🇷", es: "🇪🇸", it: "🇮🇹" };

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
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

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
        key: "search",
        label: translations.search,
        icon: <FiSearch size={16} />,
        action: () => router.push("/search"),
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

  const handleSearch = () => {
    if (searchQuery.trim() !== "") {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
    }
  };

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
        backgroundColor: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        position: "sticky",
        top: 0,
        zIndex: 1000,
        boxSizing: "border-box",
      }}
    >
      {/* Venstre: Hjem + søkefelt */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center" }}>
          <FiHome size={28} style={{ cursor: "pointer" }} />
        </Link>

        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={searchQuery}
            placeholder={translations.search}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            style={{
              padding: "0.5rem 2.5rem 0.5rem 1rem",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "1rem",
              outline: "none",
              width: "220px",
            }}
          />

          <FiSearch
            size={18}
            onClick={handleSearch}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              cursor: "pointer",
              color: "#555",
            }}
          />
        </div>
      </div>

      {/* Høyre: Hamburger + ikoner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          position: "relative",
        }}
      >
        {/* Hamburger */}
        <div style={{ position: "relative" }}>
          <FiMenu
            size={28}
            style={{ cursor: "pointer" }}
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
                  backgroundColor: "#fff",
                  borderLeft: "1px solid #ddd",
                  boxShadow: "-5px 0 15px rgba(0,0,0,0.2)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  zIndex: 2000,
                  overflowY: "auto",
                }}
              >
                <div
                  style={{
                    padding: "2rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <FiChevronLeft
                    size={28}
                    style={{ cursor: "pointer" }}
                    onClick={() => setOpen(false)}
                  />
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                    {translations.navigate}
                  </h2>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "1.5rem",
                    padding: "0 2rem 2rem",
                  }}
                >
                  <Link
                    href={currentUser ? "/profile" : "/login"}
                    onClick={() => setOpen(false)}
                    style={{
                      padding: "1rem",
                      borderRadius: "14px",
                      background: "#f8fafb",
                      border: "1px solid #e7eaee",
                      textDecoration: "none",
                      display: "block",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.78rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#667085",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {translations.account}
                    </div>
                    <div style={{ fontWeight: 700, color: "#101828", marginBottom: "0.2rem" }}>
                      {currentUser?.username || currentUser?.email || translations.guest}
                    </div>
                    <div style={{ color: "#667085", fontSize: "0.92rem" }}>
                      {currentUser?.email
                        ? `${translations.signedInAs} ${currentUser.email}`
                        : translations.guest}
                    </div>
                  </Link>

                  <section>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#667085",
                        marginBottom: "0.75rem",
                      }}
                    >
                      {translations.navigate}
                    </div>
                    <div style={{ display: "grid", gap: "0.55rem" }}>
                      {pages.map((p) => {
                        const isActive =
                          p.href === "/"
                            ? pathname === "/"
                            : pathname?.startsWith(p.href);

                        return (
                          <Link
                            key={p.nameKey}
                            href={p.href}
                            style={{
                              padding: "0.95rem 1rem",
                              textDecoration: "none",
                              color: isActive ? "#fff" : "#111827",
                              fontWeight: 600,
                              borderRadius: "12px",
                              background: isActive ? "#111827" : "#f8fafb",
                              border: `1px solid ${isActive ? "#111827" : "#e7eaee"}`,
                            }}
                            onClick={() => setOpen(false)}
                          >
                            {translations[p.nameKey]}
                          </Link>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#667085",
                        marginBottom: "0.75rem",
                      }}
                    >
                      {translations.quickActions}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      {quickActions.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            item.action();
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.55rem",
                            justifyContent: "center",
                            padding: "0.9rem",
                            borderRadius: "12px",
                            border: "1px solid #d0d5dd",
                            background: "#fff",
                            color: "#111827",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "0.75rem",
                    padding: "1.5rem 2rem",
                    borderTop: "1px solid #eee",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.78rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#667085",
                    }}
                  >
                    {translations.language}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    {languages.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        style={{
                          padding: "0.55rem 0.8rem",
                          borderRadius: "10px",
                          border:
                            language === lang
                              ? "2px solid #111827"
                              : "1px solid #d0d5dd",
                          background:
                            language === lang ? "#eef2f6" : "#fff",
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

        {/* Ikoner */}
        <Link href="/profile">
          <FiUser size={24} />
        </Link>

        <Link href="/search">
          <FiSearch size={24} />
        </Link>

        <Link href="/settings">
          <FiSettings size={24} />
        </Link>
      </div>
    </header>
  );
}