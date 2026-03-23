"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_ADMIN, ROLE_UTLEIER, ROLE_USER } from "../../lib/roles";
import styles from "../reserver/Reserver.module.css";

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState({});
  const [role, setRole] = useState(null);

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

    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(userId)}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
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
          {users.map((user) => (
            <tr key={user.id}>
              <td style={{ padding: "8px" }}>{user.username}</td>
              <td style={{ padding: "8px" }}>{user.email}</td>
              <td style={{ padding: "8px" }}>{user.role}</td>
              <td style={{ padding: "8px" }}>{new Date(user.created_at).toLocaleString()}</td>
              <td style={{ padding: "8px" }}>
                <select
                  value={user.role}
                  onChange={(e) => updateRole(user.id, e.target.value)}
                  disabled={saving[user.id]}
                  style={{ marginRight: 8 }}
                >
                  <option value={ROLE_USER}>Bruker</option>
                  <option value={ROLE_UTLEIER}>Utleier</option>
                  <option value={ROLE_ADMIN}>Admin</option>
                </select>
                <button
                  type="button"
                  disabled={saving[user.id]}
                  onClick={() => updateRole(user.id, user.role)}
                >
                  {saving[user.id] ? "Lagrer…" : "Lagre"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
