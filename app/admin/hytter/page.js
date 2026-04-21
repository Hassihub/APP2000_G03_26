"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_ADMIN } from "../../../lib/roles";
import styles from "../../reserver/Reserver.module.css";

export default function AdminCabinsPage() {
  const router = useRouter();
  const [cabins, setCabins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState({});
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const CABINS_PER_PAGE = 10;

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const meRes = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (!meRes.ok) {
          router.push("/login");
          return;
        }

        const meData = await meRes.json().catch(() => ({}));
        if (!meData?.user) {
          router.push("/login");
          return;
        }

        if (meData.user.role !== ROLE_ADMIN) {
          setError("Du har ikke tilgang til denne siden.");
          return;
        }

        const cabinsRes = await fetch("/api/cabins", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (!cabinsRes.ok) {
          const json = await cabinsRes.json().catch(() => ({}));
          throw new Error(json?.error || "Kunne ikke hente hytter");
        }

        const data = await cabinsRes.json().catch(() => ({}));
        if (alive) setCabins(Array.isArray(data?.cabins) ? data.cabins : []);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Noe gikk galt");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [router]);

  async function deleteCabin(cabinId) {
    if (!window.confirm("Er du sikker på at du vil slette denne hytta?")) return;

    setDeleting((prev) => ({ ...prev, [cabinId]: true }));
    setError("");

    try {
      const res = await fetch(`/api/cabins/${encodeURIComponent(cabinId)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Kunne ikke slette hytta");
      }

      setCabins((prev) => prev.filter((c) => String(c.id) !== String(cabinId)));
    } catch (err) {
      setError(err?.message || "Noe gikk galt");
    } finally {
      setDeleting((prev) => ({ ...prev, [cabinId]: false }));
    }
  }

  const filteredCabins = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return cabins;

    return cabins.filter((cabin) => {
      const name = String(cabin?.name || "").toLowerCase();
      const location = String(cabin?.location || "").toLowerCase();
      const owner = String(cabin?.owner_name || "").toLowerCase();
      return name.includes(query) || location.includes(query) || owner.includes(query);
    });
  }, [cabins, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCabins.length / CABINS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * CABINS_PER_PAGE;
  const endIndex = startIndex + CABINS_PER_PAGE;
  const paginatedCabins = filteredCabins.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div style={{ padding: "2rem", maxWidth: "1100px", margin: "0 auto" }}>
        <h1>Admin - Hytter</h1>
        <p>Laster...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/admin">Admin oversikt</Link>
        <span>|</span>
        <Link href="/admin/brukere">Brukere</Link>
        <span>|</span>
        <Link href="/admin/turer">Turer til verifisering</Link>
      </div>

      <h1>Admin - Hytter</h1>
      {error ? <div className={styles.errorBox}>❌ {error}</div> : null}

      <p>Her kan du finne, redigere og slette hytter.</p>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          type="search"
          placeholder="Sok pa navn, sted eller eier"
          style={{
            minWidth: "280px",
            padding: "0.55rem 0.7rem",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "var(--bg-input)",
            color: "var(--text)",
          }}
        />

        <span style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
          {filteredCabins.length > 0
            ? `Viser ${startIndex + 1}-${Math.min(endIndex, filteredCabins.length)} av ${filteredCabins.length}`
            : "Ingen hytter funnet"}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px" }}>Navn</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Sted</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Pris/natt</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Kapasitet</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Eier</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Handling</th>
            </tr>
          </thead>

          <tbody>
            {paginatedCabins.map((cabin) => (
              <tr key={cabin.id}>
                <td style={{ padding: "8px" }}>{cabin.name}</td>
                <td style={{ padding: "8px" }}>{cabin.location}</td>
                <td style={{ padding: "8px" }}>
                  {Number.isFinite(Number(cabin.price_per_night))
                    ? `${Number(cabin.price_per_night).toLocaleString("nb-NO")} kr`
                    : "-"}
                </td>
                <td style={{ padding: "8px" }}>{cabin.capacity ?? "-"}</td>
                <td style={{ padding: "8px" }}>{cabin.owner_name || "-"}</td>
                <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                  <Link
                    href={`/reserver/edit?cabinId=${encodeURIComponent(cabin.id)}`}
                    style={{
                      display: "inline-block",
                      marginRight: "8px",
                      padding: "4px 8px",
                      border: "1px solid var(--border)",
                      borderRadius: "4px",
                      textDecoration: "none",
                      color: "var(--text)",
                    }}
                  >
                    Rediger
                  </Link>

                  <button
                    type="button"
                    onClick={() => deleteCabin(cabin.id)}
                    disabled={Boolean(deleting[cabin.id])}
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#d32f2f",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: deleting[cabin.id] ? "not-allowed" : "pointer",
                      opacity: deleting[cabin.id] ? 0.7 : 1,
                    }}
                  >
                    {deleting[cabin.id] ? "Sletter..." : "Slett"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center", gap: "1rem", alignItems: "center" }}>
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          style={{
            padding: "0.6rem 1rem",
            borderRadius: "4px",
            border: "1px solid var(--border)",
            background: currentPage === 1 ? "var(--bg-muted)" : "var(--bg-panel)",
            color: "var(--text)",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            opacity: currentPage === 1 ? 0.5 : 1,
          }}
        >
          ← Forrige
        </button>

        <span style={{ color: "var(--text-muted)", minWidth: "120px", textAlign: "center" }}>
          Side {currentPage} av {totalPages}
        </span>

        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          style={{
            padding: "0.6rem 1rem",
            borderRadius: "4px",
            border: "1px solid var(--border)",
            background: currentPage === totalPages ? "var(--bg-muted)" : "var(--bg-panel)",
            color: "var(--text)",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            opacity: currentPage === totalPages ? 0.5 : 1,
          }}
        >
          Neste →
        </button>
      </div>
    </div>
  );
}
