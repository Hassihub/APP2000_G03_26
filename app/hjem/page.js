"use client";

import { useEffect, useState } from "react";

export default function Hjem() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch("/api/auth/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => setUsers([]));
  }, []);

  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>{u.username || u.email}</li>
      ))}
    </ul>
  );
}
