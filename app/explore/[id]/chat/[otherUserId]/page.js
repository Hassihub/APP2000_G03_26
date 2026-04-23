"use client";

// Denne siden kjører som en client component i Next.js.
// Det gjør at vi kan bruke React-hooks, browser-API-er og sanntidsoppdatering i nettleseren.

// Importerer React-hooks:
// - useState for lokal state
// - useEffect for sideeffekter
// - useCallback for memoiserte funksjoner
// - useMemo for utregnede verdier
// - useRef for referanser til DOM og mutable objekter
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Importerer Next.js hooks for å lese URL-parametere og navigere mellom sider.
import { useParams, useRouter } from "next/navigation";

// CSS-modulen for privat chat-siden.
import styles from "./privateChat.module.css";


// Hovedkomponenten for privat chat mellom to brukere på en tur.
export default function TripPrivateChatPage() {
  // Leser route-parametere fra URL-en.
  // Her brukes blant annet:
  // - params.id = tur-ID
  // - params.otherUserId = brukeren man chatter med
  const params = useParams();

  // Router brukes til å navigere tilbake til turgruppa.
  const router = useRouter();

  // All data for privat chat hentes fra backend og lagres her.
  // Denne vil typisk inneholde:
  // - trip
  // - otherUser
  // - messages
  // - currentUserId
  const [chatData, setChatData] = useState(null);

  // State som sier om siden fortsatt laster.
  const [loading, setLoading] = useState(true);

  // State for feil som skal vises i UI.
  const [error, setError] = useState("");

  // Teksten brukeren skriver i tekstfeltet.
  const [message, setMessage] = useState("");

  // Forhåndsvisning av valgt bilde før det sendes.
  const [imagePreview, setImagePreview] = useState("");

  // Den faktiske filen brukeren har valgt.
  const [selectedFile, setSelectedFile] = useState(null);

  // State for om melding/bilde holder på å sendes.
  const [sending, setSending] = useState(false);

  // Når brukeren klikker på et bilde i chatten,
  // lagres det her for å vises i full størrelse i modal.
  const [selectedImage, setSelectedImage] = useState(null);

  // Ref til filinput-feltet.
  // Brukes for å kunne nullstille valgt fil programmatisk.
  const fileInputRef = useRef(null);

  // Ref til et tomt element nederst i meldingslisten.
  // Brukes for å scrolle til bunnen av chatten.
  const messagesEndRef = useRef(null);

  // Ref til aktiv EventSource for sanntidsstreamen.
  const eventSourceRef = useRef(null);

  // Regner ut siste meldings-ID i nåværende chat.
  // Denne brukes når streamen startes, slik at backend vet hvilke meldinger som er nye.
  const lastMessageId = useMemo(() => {
    if (!chatData?.messages?.length) return 0;
    return Number(chatData.messages[chatData.messages.length - 1]?.id || 0);
  }, [chatData?.messages]);

  // Hjelpefunksjon for å scrolle til bunnen av meldingslisten.
  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Legger til en melding i state hvis den ikke allerede finnes.
  // Dette hindrer dubletter hvis samme melding kommer både fra direkte POST-respons og sanntidsstream.
  const appendMessageIfMissing = useCallback((incomingMessage) => {
    setChatData((prev) => {
      if (!prev) return prev;

      const exists = (prev.messages || []).some(
        (msg) => String(msg.id) === String(incomingMessage.id)
      );

      if (exists) return prev;

      return {
        ...prev,
        messages: [...(prev.messages || []), incomingMessage],
      };
    });
  }, []);

  // Henter privat chat-data fra backend.
  const fetchChat = useCallback(async () => {
    try {
      // Starter laste-state og nullstiller feil.
      setLoading(true);
      setError("");

      // Kaller API-et for privat chat på aktuell tur og bruker.
      const res = await fetch(
        `/api/trips/${params.id}/private-chat/${params.otherUserId}`,
        {
          credentials: "include",
        }
      );

      // Leser responsen som JSON.
      const data = await res.json();

      // Hvis backend returnerer feil, kast den.
      if (!res.ok) {
        throw new Error(data?.details || data?.error || "Kunne ikke hente privat chat");
      }

      // Lagrer chat-data i state.
      setChatData(data);
    } catch (err) {
      // Lagrer feilmelding i state.
      setError(err.message || "Noe gikk galt");
    } finally {
      // Slår av laste-state.
      setLoading(false);
    }
  }, [params?.id, params?.otherUserId]);

  // Henter chatten når siden lastes eller når route-parametrene endres.
  useEffect(() => {
    if (params?.id && params?.otherUserId) {
      fetchChat();
    }
  }, [params?.id, params?.otherUserId, fetchChat]);

  // Når chatData er lastet, scroll til bunnen med en gang.
  useEffect(() => {
    if (!chatData) return;
    scrollToBottom("auto");
  }, [chatData, scrollToBottom]);

  // Setter opp sanntidsstream for privat chat med Server-Sent Events.
  useEffect(() => {
    // Ikke opprett stream før vi faktisk har params og chatData.
    if (!params?.id || !params?.otherUserId || !chatData) return;

    // Lukk eksisterende stream hvis det finnes en.
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Oppretter ny EventSource mot stream-endepunktet.
    const es = new EventSource(
      `/api/trips/${params.id}/private-chat/${params.otherUserId}/stream?lastMessageId=${lastMessageId}`
    );

    // Lagrer referansen til streamen.
    eventSourceRef.current = es;

    // Lytter på vanlige "message"-events fra streamen.
    es.addEventListener("message", (event) => {
      try {
        // Parser data som JSON.
        const incomingMessage = JSON.parse(event.data);

        // Legger til meldingen hvis den ikke allerede finnes.
        appendMessageIfMissing(incomingMessage);

        // Scroller til bunnen etter at ny melding kom inn.
        requestAnimationFrame(() => scrollToBottom("smooth"));
      } catch {}
    });

    // Rydder opp når komponenten unmountes eller dependencies endres.
    return () => {
      es.close();
    };
  }, [
    params?.id,
    params?.otherUserId,
    chatData,
    lastMessageId,
    appendMessageIfMissing,
    scrollToBottom,
  ]);

  // Håndterer filvalg fra filinput.
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    // Nullstiller gammel feil.
    setError("");

    // Hvis ingen fil er valgt, nullstill bilde-state.
    if (!file) {
      setSelectedFile(null);
      setImagePreview("");
      return;
    }

    // Bare bildefiler er tillatt.
    if (!file.type.startsWith("image/")) {
      setError("Du kan bare laste opp bilder");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Filstørrelsen er begrenset til 3 MB.
    if (file.size > 3 * 1024 * 1024) {
      setError("Bildet er for stort. Maks 3 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Lagre valgt fil i state.
    setSelectedFile(file);

    // Les fila som data-URL for å kunne vise forhåndsvisning.
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Nullstiller valgt bilde og file input.
  const clearSelectedImage = () => {
    setSelectedFile(null);
    setImagePreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Håndterer sending av melding og/eller bilde.
  const handleSend = async (e) => {
    // Hindrer standard form-submit.
    e?.preventDefault?.();

    // Trimmer whitespace i meldingen.
    const trimmed = message.trim();

    // Ikke send hvis det verken er tekst eller bilde.
    if (!trimmed && !selectedFile) return;

    try {
      // Starter sending-state og nullstiller feil.
      setSending(true);
      setError("");

      // Bruker FormData siden vi kan sende både tekst og fil.
      const formData = new FormData();
      formData.append("message", trimmed);

      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      // Kaller API-et som sender privat melding.
      const res = await fetch(
        `/api/trips/${params.id}/private-chat/${params.otherUserId}/messages`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      // Leser responsen som JSON.
      const data = await res.json();

      // Hvis backend returnerer feil, kast den.
      if (!res.ok) {
        throw new Error(data?.details || data?.error || "Kunne ikke sende privat melding");
      }

      // Legg til meldingen lokalt hvis den ikke allerede finnes.
      appendMessageIfMissing(data.message);

      // Nullstill tekstfelt og valgt bilde.
      setMessage("");
      clearSelectedImage();

      // Scroll til bunnen etter sending.
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch (err) {
      // Vis feilmelding.
      setError(err.message || "Noe gikk galt");
    } finally {
      // Slå av sending-state.
      setSending(false);
    }
  };

  // Hvis siden fortsatt laster, vis laste-tekst.
  if (loading) {
    return (
      <main className={styles.container}>
        <p>Laster privat chat...</p>
      </main>
    );
  }

  // Hvis det er feil og vi ikke har chatData, vis fallback med tilbakeknapp.
  if (error && !chatData) {
    return (
      <main className={styles.container}>
        <button
          className={styles.backButton}
          onClick={() => router.push(`/explore/${params.id}/group`)}
          type="button"
        >
          ← Tilbake til turgruppen
        </button>
        <p className={styles.error}>{error}</p>
      </main>
    );
  }

  // Hvis ingen chatData finnes i det hele tatt, vis fallback.
  if (!chatData) {
    return (
      <main className={styles.container}>
        <button
          className={styles.backButton}
          onClick={() => router.push(`/explore/${params.id}/group`)}
          type="button"
        >
          ← Tilbake til turgruppen
        </button>
        <p>Fant ikke privat chat.</p>
      </main>
    );
  }

  // Selve UI-et for privat chat-siden.
  return (
    <>
      <main className={styles.container}>
        {/* Tilbakeknapp til turgruppen */}
        <button
          className={styles.backButton}
          onClick={() => router.push(`/explore/${params.id}/group`)}
          type="button"
        >
          ← Tilbake til turgruppen
        </button>

        {/* Toppseksjon med tittel og info om hvem man chatter med */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Privat chat</h1>
            <p className={styles.subtitle}>
              {chatData.trip?.navn} • {chatData.otherUser?.username}
            </p>
          </div>
        </div>

        {/* Eventuell feilmelding */}
        {error && <p className={styles.error}>{error}</p>}

        {/* Selve chat-seksjonen */}
        <section className={styles.chatSection}>
          {/* Meldingsliste */}
          <div className={styles.messages}>
            {chatData.messages?.length > 0 ? (
              chatData.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.messageCard} ${
                    msg.user_id === chatData.currentUserId ? styles.ownMessage : ""
                  }`}
                >
                  {/* Header på meldingen med brukerinfo og tidspunkt */}
                  <div className={styles.messageHeader}>
                    <div className={styles.messageUser}>
                      <img
                        src={msg.avatar || "/images/profilbilde.jpg"}
                        alt={msg.username}
                        className={styles.messageAvatar}
                      />
                      <strong>
                        {msg.username}
                        {msg.user_id === chatData.currentUserId ? " (deg)" : ""}
                      </strong>
                    </div>
                    <span>{new Date(msg.created_at).toLocaleString("no-NO")}</span>
                  </div>

                  {/* Hvis meldingen er et bilde, vis bildeblokk */}
                  {msg.message_type === "image" && msg.image_url ? (
                    <div className={styles.imageMessageWrap}>
                      <img
                        src={msg.image_url}
                        alt="Sendt bilde"
                        className={styles.chatImage}
                        onClick={() => setSelectedImage(msg.image_url)}
                      />
                      {/* Hvis bildet også har tilhørende tekst, vis den */}
                      {msg.message && msg.message !== "[bilde]" && (
                        <p className={styles.messageText}>{msg.message}</p>
                      )}
                    </div>
                  ) : (
                    // Vanlig tekstmelding
                    <p className={styles.messageText}>{msg.message}</p>
                  )}
                </div>
              ))
            ) : (
              // Hvis ingen meldinger finnes
              <p>Ingen meldinger enda. Start samtalen.</p>
            )}

            {/* Usynlig element nederst som brukes til autoscroll */}
            <div ref={messagesEndRef} />
          </div>

          {/* Skjema for å sende melding */}
          <form onSubmit={handleSend} className={styles.form}>
            {/* Tekstfelt */}
            <textarea
              className={styles.textarea}
              placeholder="Skriv en privat melding..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              onKeyDown={(e) => {
                // Enter uten shift sender meldingen
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />

            {/* Opplastingsrad for bilde */}
            <div className={styles.uploadRow}>
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />

              {/* Hvis bruker har valgt bilde, vis knapp for å fjerne det */}
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

            {/* Forhåndsvisning av valgt bilde */}
            {imagePreview && (
              <div className={styles.previewWrap}>
                <img
                  src={imagePreview}
                  alt="Forhåndsvisning"
                  className={styles.previewImage}
                />
              </div>
            )}

            {/* Sendeknapp */}
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

      {/* Modal for å vise bilde i full størrelse */}
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