"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function MessagesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  // Load logged-in user
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
        });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        const data = await res.json();
        setCurrentUser(data.user);
      } catch {
        setError("Kunne ikke hente innlogget bruker");
      }
    };

    loadCurrentUser();
  }, [router]);

  // Load all users for selection
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch("/api/auth/users", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Kunne ikke hente brukere");
          setUsers([]);
          return;
        }

        setUsers(data.users || []);
      } catch {
        setError("Kunne ikke hente brukere");
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, []);

  const loadConversation = async (otherUserId, { silent } = {}) => {
    if (!otherUserId) return;
    if (!silent) {
      setLoadingMessages(true);
    }
    setError("");
    try {
      const res = await fetch(`/api/messages?otherUserId=${otherUserId}`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Kunne ikke hente meldinger");
        setMessages([]);
        return;
      }

      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      setError("Kunne ikke hente meldinger");
    } finally {
      if (!silent) {
        setLoadingMessages(false);
      }
    }
  };

  const handleSelectUser = (e) => {
    const otherId = e.target.value;
    setSelectedUserId(otherId);
    setMessages([]);
    if (otherId) {
      loadConversation(otherId);
    }
  };

  // Poll for new messages every 3 seconds when a conversation is selected
  useEffect(() => {
    if (!selectedUserId) return undefined;

    const intervalId = setInterval(() => {
      loadConversation(selectedUserId, { silent: true });
    }, 2000);

    return () => clearInterval(intervalId);
  }, [selectedUserId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedUserId || !newMessage.trim()) return;

    setError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ receiverId: selectedUserId, content: newMessage }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kunne ikke sende melding");
        return;
      }

      setMessages((prev) => [...prev, data.message]);
      setNewMessage("");
    } catch {
      setError("Kunne ikke sende melding");
    }
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!currentUser) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Laster...</p>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => u.id !== currentUser.id);

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Meldinger</h1>
      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>
          {error}
        </p>
      )}

      <section style={{ marginTop: "1.5rem" }}>
        <label>
          Velg bruker å chatte med:
          <select
            value={selectedUserId}
            onChange={handleSelectUser}
            style={{ marginLeft: "0.5rem", padding: "0.25rem" }}
          >
            <option value="">-- Velg --</option>
            {loadingUsers ? (
              <option value="" disabled>
                Laster brukere...
              </option>
            ) : (
              filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username || u.email}
                </option>
              ))
            )}
          </select>
        </label>
      </section>

      {selectedUserId && (
        <section style={{ marginTop: "2rem" }}>
          <div
            style={{
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "1rem",
              maxHeight: "400px",
              overflowY: "auto",
            }}
          >
            {loadingMessages ? (
              <p>Laster meldinger...</p>
            ) : messages.length === 0 ? (
              <p>Ingen meldinger ennå. Skriv den første!</p>
            ) : (
              messages.map((m) => {
                const isMine = m.sender_id === currentUser.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: isMine ? "flex-end" : "flex-start",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: isMine ? "#1976d2" : "#e0e0e0",
                        color: isMine ? "white" : "black",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "12px",
                        maxWidth: "70%",
                      }}
                    >
                      <div style={{ fontSize: "0.9rem" }}>{m.content}</div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.8, marginTop: "0.25rem" }}>
                        {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              placeholder="Skriv en melding..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              style={{ flex: 1, padding: "0.5rem" }}
            />
            <button type="submit" style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
              Send
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
