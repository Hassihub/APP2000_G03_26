"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_ADMIN, ROLE_UTLEIER, ROLE_TURLEDER, ROLE_USER } from "../../lib/roles";
import styles from "../reserver/Reserver.module.css";

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState({});
  const [deleting, setDeleting] = useState({});
  const [role, setRole] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterRole, setFilterRole] = useState("ALL");
  
  const USERS_PER_PAGE = 10;

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (!res.ok) {
          router.push("/login");
          return;
        }

        const data = await res.json().catch(() => ({}));
        if (!data?.user) {
          router.push("/login");
          return;
        }

        if (data.user.role !== ROLE_ADMIN) {
          setError("Du har ikke tilgang til denne siden.");
          return;
        }

        setRole(data.user.role);

        const usersRes = await fetch("/api/auth/users", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;
        if (!usersRes.ok) {
          const json = await usersRes.json().catch(() => ({}));
          throw new Error(json?.error || "Kunne ikke hente brukere");
        }

        const { users } = await usersRes.json();
        if (alive) setUsers(users || []);
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

  async function updateRole(userId, newRole) {
    setSaving((prev) => ({ ...prev, [userId]: true }));
    setError("");

    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(userId)}/role?role=${encodeURIComponent(newRole)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Kunne ikke oppdatere rolle");
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: json.user.role } : u))
      );
    } catch (err) {
      setError(err?.message || "Noe gikk galt");
    } finally {
      setSaving((prev) => ({ ...prev, [userId]: false }));
    }
  }

  async function deleteUser(userId) {
    if (!window.confirm("Er du sikker på at du vil slette denne brukeren?")) return;

    setDeleting((prev) => ({ ...prev, [userId]: true }));
    setError("");

    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Kunne ikke slette bruker");
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      setError(err?.message || "Noe gikk galt");
    } finally {
      setDeleting((prev) => ({ ...prev, [userId]: false }));
    }
  }

  // Filtrer brukere basert på valgt rolle
  const filteredUsers = filterRole === "ALL" 
    ? users 
    : users.filter((u) => u.role === filterRole);

  // Kalkuler paginering
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const endIndex = startIndex + USERS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset til første side når filter endres
  const handleFilterChange = (newFilter) => {
    setFilterRole(newFilter);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        <h1>Admin</h1>
        <p>Laster...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "960px", margin: "0 auto" }}>
      <h1>Admin</h1>
      {error ? <div className={styles.errorBox}>❌ {error}</div> : null}

      <p>Her kan du endre brukernes roller.</p>

      <div style={{ marginBottom: "1.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600 }}>Filtrer etter rolle:</span>
          <select
            value={filterRole}
            onChange={(e) => handleFilterChange(e.target.value)}
            style={{
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              fontSize: "0.95rem",
              backgroundColor: "var(--bg-input)",
              color: "var(--text)",
            }}
          >
            <option value="ALL">Alle brukere ({users.length})</option>
            <option value={ROLE_USER}>Bruker ({users.filter(u => u.role === ROLE_USER).length})</option>
            <option value={ROLE_UTLEIER}>Utleier ({users.filter(u => u.role === ROLE_UTLEIER).length})</option>
            <option value={ROLE_TURLEDER}>Turleder ({users.filter(u => u.role === ROLE_TURLEDER).length})</option>
            <option value={ROLE_ADMIN}>Admin ({users.filter(u => u.role === ROLE_ADMIN).length})</option>
          </select>
        </label>
        <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Viser {startIndex + 1}–{Math.min(endIndex, filteredUsers.length)} av {filteredUsers.length}
        </span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px" }}>Brukernavn</th>
            <th style={{ textAlign: "left", padding: "8px" }}>E-post</th>
            <th style={{ textAlign: "left", padding: "8px" }}>Rolle</th>
            <th style={{ textAlign: "left", padding: "8px" }}>Opprettet</th>
            <th style={{ textAlign: "left", padding: "8px" }}>Handling</th>
          </tr>
        </thead>
        <tbody>
          {paginatedUsers.map((user) => (
            <tr key={user.id}>
              <td style={{ padding: "8px" }}>{user.username}</td>
              <td style={{ padding: "8px" }}>{user.email}</td>
              <td style={{ padding: "8px" }}>{user.role}</td>
              <td style={{ padding: "8px" }}>{new Date(user.created_at).toLocaleString()}</td>
              <td style={{ padding: "8px" }}>
                <select
                  value={user.role}
                  onChange={(e) => {
                    if (saving[user.id]) return;
                    updateRole(user.id, e.target.value);
                  }}
                  disabled={saving[user.id] || deleting[user.id]}
                  style={{ marginRight: 8, padding: "4px" }}
                >
                  <option value={ROLE_USER}>Bruker</option>
                  <option value={ROLE_UTLEIER}>Utleier</option>
                  <option value={ROLE_TURLEDER}>Turleder</option>
                  <option value={ROLE_ADMIN}>Admin</option>
                </select>
                {saving[user.id] && <span style={{ marginLeft: "8px" }}>Lagrer…</span>}
                <button
                  type="button"
                  disabled={deleting[user.id] || saving[user.id]}
                  onClick={() => deleteUser(user.id)}
                  style={{
                    marginLeft: "8px",
                    padding: "4px 8px",
                    backgroundColor: "#d32f2f",
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {deleting[user.id] ? "Sletter…" : "Slett"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: "2rem", display: "flex", justifyContent: "center", gap: "1rem", alignItems: "center" }}>
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
            fontWeight: 600,
            opacity: currentPage === 1 ? 0.5 : 1,
          }}
        >
          ← Forrige
        </button>

        <span style={{ color: "var(--text-muted)", fontSize: "0.95rem", minWidth: "120px", textAlign: "center" }}>
          Side {currentPage} av {totalPages || 1}
        </span>

        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages || totalPages === 0}
          style={{
            padding: "0.6rem 1rem",
            borderRadius: "4px",
            border: "1px solid var(--border)",
            background: currentPage === totalPages || totalPages === 0 ? "var(--bg-muted)" : "var(--bg-panel)",
            color: "var(--text)",
            cursor: currentPage === totalPages || totalPages === 0 ? "not-allowed" : "pointer",
            fontWeight: 600,
            opacity: currentPage === totalPages || totalPages === 0 ? 0.5 : 1,
          }}
        >
          Neste →
        </button>
      </div>
    </div>
  );
}
