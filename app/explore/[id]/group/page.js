"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./group.module.css";

export default function TripGroupPage() {
  const params = useParams();
  const router = useRouter();

  const [groupData, setGroupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [liveStatus, setLiveStatus] = useState("kobler til...");
  const messagesEndRef = useRef(null);
  const eventSourceRef = useRef(null);

  const lastMessageId = useMemo(() => {
    if (!groupData?.messages?.length) return 0;
    return Number(groupData.messages[groupData.messages.length - 1]?.id || 0);
  }, [groupData?.messages]);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const appendMessageIfMissing = useCallback((incomingMessage) => {
    setGroupData((prev) => {
      if (!prev) return prev;

      const exists = (prev.messages || []).some(
        (msg) => String(msg.id) === String(incomingMessage.id)
      );

      if (exists) {
        return prev;
      }

      return {
        ...prev,
        messages: [...(prev.messages || []), incomingMessage],
      };
    });
  }, []);

  const fetchGroup = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/trips/${params.id}/group`, {
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.details || data?.error || "Kunne ikke hente turgruppen");
      }

      setGroupData(data);
    } catch (err) {
      setError(err.message || "Noe gikk galt");
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    if (params?.id) {
      fetchGroup();
    }
  }, [params?.id, fetchGroup]);

  useEffect(() => {
    if (!groupData) return;
    scrollToBottom("auto");
  }, [groupData, scrollToBottom]);

  useEffect(() => {
    if (!params?.id || !groupData) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(
      `/api/trips/${params.id}/group/stream?lastMessageId=${lastMessageId}`
    );

    eventSourceRef.current = es;
    setLiveStatus("live");

    es.addEventListener("ready", () => {
      setLiveStatus("live");
    });

    es.addEventListener("message", (event) => {
      try {
        const incomingMessage = JSON.parse(event.data);
        appendMessageIfMissing(incomingMessage);
        requestAnimationFrame(() => scrollToBottom("smooth"));
      } catch {}
    });

    es.addEventListener("ping", () => {
      setLiveStatus("live");
    });

    es.addEventListener("error", () => {
      setLiveStatus("frakoblet");
    });

    es.onerror = () => {
      setLiveStatus("prøver å koble til...");
    };

    return () => {
      es.close();
    };
  }, [params?.id, groupData, lastMessageId, appendMessageIfMissing, scrollToBottom]);

  const handleSend = async (e) => {
    e.preventDefault();

    const trimmed = message.trim();
    if (!trimmed) return;

    try {
      setSending(true);
      setError("");

      const res = await fetch(`/api/trips/${params.id}/group/messages`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.details || data?.error || "Kunne ikke sende melding");
      }

      appendMessageIfMissing(data.message);
      setMessage("");
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch (err) {
      setError(err.message || "Noe gikk galt");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <main className={styles.container}>
        <p>Laster turgruppe...</p>
      </main>
    );
  }

  if (error && !groupData) {
    return (
      <main className={styles.container}>
        <button
          className={styles.backButton}
          onClick={() => router.push(`/explore/${params.id}`)}
          type="button"
        >
          ← Tilbake til turen
        </button>
        <p className={styles.error}>{error}</p>
      </main>
    );
  }

  if (!groupData) {
    return (
      <main className={styles.container}>
        <button
          className={styles.backButton}
          onClick={() => router.push(`/explore/${params.id}`)}
          type="button"
        >
          ← Tilbake til turen
        </button>
        <p>Fant ikke turgruppen.</p>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <button
        className={styles.backButton}
        onClick={() => router.push(`/explore/${params.id}`)}
        type="button"
      >
        ← Tilbake til turen
      </button>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Turgruppe</h1>
          <p className={styles.subtitle}>{groupData.trip?.navn}</p>
        </div>
        <div className={styles.liveBadge}>
          Status: {liveStatus}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.membersSection}>
        <h2>Deltakere</h2>
        <div className={styles.membersList}>
          {groupData.members?.length > 0 ? (
            groupData.members.map((member) => (
              <div key={member.id} className={styles.member}>
                <img
                  src={member.avatar || "/images/profilbilde.jpg"}
                  alt={member.username}
                  className={styles.avatar}
                />
                <span>
                  {member.username}
                  {member.id === groupData.currentUserId ? " (deg)" : ""}
                </span>
              </div>
            ))
          ) : (
            <p>Ingen deltakere enda.</p>
          )}
        </div>
      </section>

      <section className={styles.chatSection}>
        <h2>Chat</h2>

        <div className={styles.messages}>
          {groupData.messages?.length > 0 ? (
            groupData.messages.map((msg) => (
              <div key={msg.id} className={styles.messageCard}>
                <div className={styles.messageHeader}>
                  <div className={styles.messageUser}>
                    <img
                      src={msg.avatar || "/images/profilbilde.jpg"}
                      alt={msg.username}
                      className={styles.messageAvatar}
                    />
                    <strong>
                      {msg.username}
                      {msg.user_id === groupData.currentUserId ? " (deg)" : ""}
                    </strong>
                  </div>
                  <span>{new Date(msg.created_at).toLocaleString("no-NO")}</span>
                </div>
                <p className={styles.messageText}>{msg.message}</p>
              </div>
            ))
          ) : (
            <p>Ingen meldinger enda. Start samtalen.</p>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className={styles.form}>
          <textarea
            className={styles.textarea}
            placeholder="Skriv en melding til gruppa..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />
          <button
            className={styles.sendButton}
            type="submit"
            disabled={sending}
          >
            {sending ? "Sender..." : "Send melding"}
          </button>
        </form>
      </section>
    </main>
  );
}