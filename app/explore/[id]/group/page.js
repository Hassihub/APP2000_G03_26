// Konrad - 274088
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
  const [imagePreview, setImagePreview] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const fileInputRef = useRef(null);
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
        (msg) => String(msg.id) === String(incomingMessage.id),
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
        throw new Error(
          data?.details || data?.error || "Kunne ikke hente turgruppen",
        );
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
      `/api/trips/${params.id}/group/stream?lastMessageId=${lastMessageId}`,
    );

    eventSourceRef.current = es;

    es.addEventListener("message", (event) => {
      try {
        const incomingMessage = JSON.parse(event.data);
        appendMessageIfMissing(incomingMessage);
        requestAnimationFrame(() => scrollToBottom("smooth"));
      } catch {}
    });

    return () => {
      es.close();
    };
  }, [
    params?.id,
    groupData,
    lastMessageId,
    appendMessageIfMissing,
    scrollToBottom,
  ]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setError("");

    if (!file) {
      setSelectedFile(null);
      setImagePreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Du kan bare laste opp bilder");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setError("Bildet er for stort. Maks 3 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearSelectedImage = () => {
    setSelectedFile(null);
    setImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();

    const trimmed = message.trim();
    if (!trimmed && !selectedFile) return;

    try {
      setSending(true);
      setError("");

      const formData = new FormData();
      formData.append("message", trimmed);

      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      const res = await fetch(`/api/trips/${params.id}/group/messages`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.details || data?.error || "Kunne ikke sende melding",
        );
      }

      appendMessageIfMissing(data.message);
      setMessage("");
      clearSelectedImage();
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch (err) {
      setError(err.message || "Noe gikk galt");
    } finally {
      setSending(false);
    }
  };

  const openPrivateChat = (otherUserId) => {
    if (!otherUserId || otherUserId === groupData?.currentUserId) return;
    router.push(`/explore/${params.id}/chat/${otherUserId}`);
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
    <>
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
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <section className={styles.membersSection}>
          <h2>Deltakere</h2>
          <div className={styles.membersList}>
            {groupData.members?.length > 0 ? (
              groupData.members.map((member) => {
                const isLeader =
                  groupData.trip?.turleder_user_id &&
                  member.id === groupData.trip.turleder_user_id;

                const isCurrentUser = member.id === groupData.currentUserId;

                return (
                  <div
                    key={member.id}
                    className={`${styles.member} ${
                      isLeader ? styles.turleder : ""
                    }`}
                  >
                    <img
                      src={member.avatar || "/images/profilbilde.jpg"}
                      alt={member.username}
                      className={styles.avatar}
                    />

                    <span>
                      {member.username}
                      {isCurrentUser ? " (deg)" : ""}
                    </span>

                    {isLeader && (
                      <span className={styles.leaderBadge}>Turleder</span>
                    )}

                    {!isCurrentUser && (
                      <button
                        type="button"
                        className={styles.privateChatButton}
                        onClick={() => openPrivateChat(member.id)}
                      >
                        Privat chat
                      </button>
                    )}
                  </div>
                );
              })
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
                        {msg.user_id === groupData.currentUserId
                          ? " (deg)"
                          : ""}
                      </strong>
                    </div>
                    <span>
                      {new Date(msg.created_at).toLocaleString("no-NO")}
                    </span>
                  </div>

                  {msg.message_type === "image" && msg.image_url ? (
                    <div className={styles.imageMessageWrap}>
                      <img
                        src={msg.image_url}
                        alt="Sendt bilde"
                        className={styles.chatImage}
                        onClick={() => setSelectedImage(msg.image_url)}
                      />
                      {msg.message && msg.message !== "[bilde]" && (
                        <p className={styles.messageText}>{msg.message}</p>
                      )}
                    </div>
                  ) : (
                    <p className={styles.messageText}>{msg.message}</p>
                  )}
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />

            <div className={styles.uploadRow}>
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
              {selectedFile && (
                <button
                  type="button"
                  className={styles.clearImageButton}
                  onClick={clearSelectedImage}
                >
                  Fjern valgt bilde
                </button>
              )}
            </div>

            {imagePreview && (
              <div className={styles.previewWrap}>
                <img
                  src={imagePreview}
                  alt="Forhåndsvisning"
                  className={styles.previewImage}
                />
              </div>
            )}

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

      {selectedImage && (
        <div
          className={styles.imageModal}
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Full størrelse"
            className={styles.fullImage}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

