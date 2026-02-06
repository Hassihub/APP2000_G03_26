"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function TopBar() {
  const [user, setUser] = useState(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
          } else {
            setUser(null);
          }
        } else if (res.status === 401) {
          // Not logged in
          setUser(null);
        }
      } catch {
        // ignore errors, treat as not logged in
        setUser(null);
      } finally {
        setCheckedAuth(true);
      }
    };

    checkAuth();
  }, [pathname]);

  const username = user?.username || user?.email;

  return (
    <header className="topbar">
      <div className="topbar-warning">Dette er et skoleprosjekt</div>
      <nav className="topbar-nav">
        <div className="topbar-links">
          <Link className="topbar-item" href="/">
            Home
          </Link>
          <Link className="topbar-item" href="/search">
            Search
          </Link>
          <Link className="topbar-item" href="/settings">
            Settings
          </Link>
        </div>
        <div className="topbar-auth">
          {checkedAuth && user ? (
            <Link className="topbar-item" href="/profile">
              {username}
            </Link>
          ) : (
            <>
              <Link className="topbar-item" href="/login">
                Logg inn
              </Link>
              <Link className="topbar-item" href="/signup">
                Registrer deg
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
