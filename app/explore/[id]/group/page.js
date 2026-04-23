"use client";

// Denne siden kjører som en client component i Next.js.
// Det gjør at vi kan bruke React-hooks, browser-API-er og sanntidsoppdatering i nettleseren.

// Denne siden viser gruppechatten for en tur.
// Her kan deltakere:
// - se medlemmer i gruppa
// - sende meldinger
// - laste opp bilder
// - motta nye meldinger i sanntid via Server-Sent Events
// - åpne privat chat med andre deltakere

// Importerer React-hooks:
// useState for state
// useEffect for sideeffekter
// useCallback for memoiserte funksjoner
// useMemo for utregnede verdier
// useRef for DOM-referanser og mutable verdier
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Importerer Next.js hooks for å lese URL-parametere og navigere.
import { useParams, useRouter } from "next/navigation";

// CSS-modulen for gruppechat-siden.
import styles from "./group.module.css";


// Hovedkomponenten for turgruppa/chatten.
export default function TripGroupPage() {
  // Leser route-parametere fra URL-en, for eksempel tur-id.
  const params = useParams();

  // Router brukes for navigasjon til andre sider.
  const router = useRouter();

  // State som inneholder all gruppedata fra backend:
  // chat, trip, departure, members, messages, currentUserId osv.
  const [groupData, setGroupData] = useState(null);

  // State som sier om siden holder på å laste.
  const [loading, setLoading] = useState(true);

  // State for feil som skal vises i UI.
  const [error, setError] = useState("");

  // State for meldingen brukeren skriver i tekstfeltet.
  const [message, setMessage] = useState("");

  // State for base64/url-preview av valgt bilde før sending.
  const [imagePreview, setImagePreview] = useState("");

  // State for faktisk valgt fil fra filinput.
  const [selectedFile, setSelectedFile] = useState(null);

  // State som sier om melding/bilde holder på å sendes.
  const [sending, setSending] = useState(false);

  // State for bilde som åpnes i fullskjerm/modal når brukeren klikker på et bilde i chatten.
  const [selectedImage, setSelectedImage] = useState(null);

  // Ref til filinput-feltet.
  // Brukes blant annet for å tømme valgt fil programmatisk.
  const fileInputRef = useRef(null);

  // Ref til et usynlig element nederst i meldingslisten.
  // Brukes for å scrolle til bunnen av chatten.
  const messagesEndRef = useRef(null);

  // Ref til EventSource-instansen som brukes for sanntidsstreaming.
  const eventSourceRef = useRef(null);

  // Regner ut siste meldings-ID i lista.
  // Denne brukes når vi starter streamen, slik at backend vet hvor vi er.
  const lastMessageId = useMemo(() => {
    if (!groupData?.messages?.length) return 0;
    return Number(groupData.messages[groupData.messages.length - 1]?.id || 0);
  }, [groupData?.messages]);

  // Hjelpefunksjon som scroller chatten til bunnen.
  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Legger til en innkommende melding i state hvis den ikke allerede finnes.
  // Dette hindrer dubletter når både egen sending og sanntidsstream kan levere samme melding.
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

  // Henter gruppedata fra backend.
  const fetchGroup = useCallback(async () => {
    try {
      // Starter laste-state og nullstiller feil.
      setLoading(true);
      setError("");

      // Kaller API-et for gruppechatten til turen.
      const res = await fetch(`/api/trips/${params.id}/group`, {
        credentials: "include",
      });

      // Leser responsen som JSON.
      const data = await res.json();

      // Hvis responsen ikke er OK, kast feil.
      if (!res.ok) {
        throw new Error(data?.details || data?.error || "Kunne ikke hente turgruppen");
      }

      // Lagrer gruppedata i state.
      setGroupData(data);
    } catch (err) {
      // Lagrer feilmelding i state.
      setError(err.message || "Noe gikk galt");
    } finally {
      // Slår av laste-state.
      setLoading(false);
    }
  }, [params?.id]);

  // Henter gruppedata når siden lastes eller tur-id endres.
  useEffect(() => {
    if (params?.id) {
      fetchGroup();
    }
  }, [params?.id, fetchGroup]);

  // Når gruppedata er lastet, scroll til bunnen med en gang.
  useEffect(() => {
    if (!groupData) return;
    scrollToBottom("auto");
  }, [groupData, scrollToBottom]);

  // Setter opp sanntidsstream med Server-Sent Events.
  useEffect(() => {
    // Ikke start stream før vi faktisk har tur-id og gruppedata.
    if (!params?.id || !groupData) return;

    // Hvis det finnes en tidligere EventSource, lukk den først.
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Oppretter ny stream mot backend.
    // lastMessageId sendes med slik at backend vet hvilken melding som er siste klienten allerede har.
    const es = new EventSource(
      `/api/trips/${params.id}/group/stream?lastMessageId=${lastMessageId}`
    );

    // Lagrer EventSource-instansen i ref.
    eventSourceRef.current = es;

    // Lytter etter nye meldinger fra streamen.
    es.addEventListener("message", (event) => {
      try {
        // Parser meldingen fra JSON.
        const incomingMessage = JSON.parse(event.data);

        // Legger meldingen til hvis den ikke allerede finnes.
        appendMessageIfMissing(incomingMessage);

        // Scroller ned når ny melding kommer inn.
        requestAnimationFrame(() => scrollToBottom("smooth"));
      } catch {}
    });

    // Rydd opp ved unmount eller når dependencies endres.
    return () => {
      es.close();
    };
  }, [params?.id, groupData, lastMessageId, appendMessageIfMissing, scrollToBottom]);

  // Håndterer valg av fil fra filinput.
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    // Nullstiller gammel feil.
    setError("");

    // Hvis ingen fil ble valgt, nullstill bilde-state.
    if (!file) {
      setSelectedFile(null);
      setImagePreview("");
      return;
    }

    // Kun bilder er lov.
    if (!file.type.startsWith("image/")) {
      setError("Du kan bare laste opp bilder");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Filstørrelse begrenses til 3 MB.
    if (file.size > 3 * 1024 * 1024) {
      setError("Bildet er for stort. Maks 3 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Lagre valgt fil i state.
    setSelectedFile(file);

    // Leser fila som data-URL for å vise forhåndsvisning i UI.
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Nullstiller valgt bilde og forhåndsvisning.
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

    // Fjerner whitespace i meldingen.
    const trimmed = message.trim();

    // Hvis det ikke finnes tekst og ikke valgt bilde, gjør ingenting.
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

      // Sender meldingen til backend.
      const res = await fetch(`/api/trips/${params.id}/group/messages`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      // Leser responsen som JSON.
      const data = await res.json();

      // Hvis backend returnerer feil, kast den.
      if (!res.ok) {
        throw new Error(data?.details || data?.error || "Kunne ikke sende melding");
      }

      // Legg til meldingen lokalt med en gang hvis den ikke allerede finnes.
      appendMessageIfMissing(data.message);

      // Nullstill tekstfelt og valgt bilde etter vellykket sending.
      setMessage("");
      clearSelectedImage();

      // Scroll til bunnen etter sending.
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch (err) {
      // Vis feilmelding ved feil.
      setError(err.message || "Noe gikk galt");
    } finally {
      // Slå av sending-state.
      setSending(false);
    }
  };

  // Åpner privat chat med en annen deltaker i turen.
  const openPrivateChat = (otherUserId) => {
    // Ikke åpne privat chat hvis bruker mangler eller hvis man klikker på seg selv.
    if (!otherUserId || otherUserId === groupData?.currentUserId) return;

    // Navigerer til privat chat-ruta for denne turen og valgt bruker.
    router.push(`/explore/${params.id}/chat/${otherUserId}`);
  };

  // Lastevisning mens gruppedata hentes.
  if (loading) {
    return (
      <main className={styles.container}>
        <p>Laster turgruppe...</p>
      </main>
    );
  }

  // Hvis det er en feil og vi ikke har gruppedata, vis tilbakeknapp og feilmelding.
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

  // Hvis ingen gruppedata finnes i det hele tatt, vis fallback.
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

  // Selve UI-et for gruppechat-siden.
  return (
    <>
      <main className={styles.container}>
        {/* Tilbakeknapp til turdetaljene */}
        <button
          className={styles.backButton}
          onClick={() => router.push(`/explore/${params.id}`)}
          type="button"
        >
          ← Tilbake til turen
        </button>

        {/* Header for gruppesiden */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Turgruppe</h1>
            <p className={styles.subtitle}>{groupData.trip?.navn}</p>
          </div>
        </div>

        {/* Feilmelding som kan vises selv om gruppedata finnes */}
        {error && <p className={styles.error}>{error}</p>}

        {/* Seksjon som viser deltakerne i gruppa */}
        <section className={styles.membersSection}>
          <h2>Deltakere</h2>

          <div className={styles.membersList}>
            {groupData.members?.length > 0 ? (
              groupData.members.map((member) => {
                // Sjekker om medlemmet er turleder.
                const isLeader =
                  groupData.trip?.turleder_user_id &&
                  member.id === groupData.trip.turleder_user_id;

                // Sjekker om medlemmet er nåværende bruker.
                const isCurrentUser = member.id === groupData.currentUserId;

                return (
                  <div
                    key={member.id}
                    className={`${styles.member} ${
                      isLeader ? styles.turleder : ""
                    }`}
                  >
                    {/* Profilbilde */}
                    <img
                      src={member.avatar || "/images/profilbilde.jpg"}
                      alt={member.username}
                      className={styles.avatar}
                    />

                    {/* Brukernavn */}
                    <span>
                      {member.username}
                      {isCurrentUser ? " (deg)" : ""}
                    </span>

                    {/* Egen badge hvis medlemmet er turleder */}
                    {isLeader && (
                      <span className={styles.leaderBadge}>Turleder</span>
                    )}

                    {/* Knapp for privat chat med andre deltakere */}
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
              // Hvis ingen deltakere finnes
              <p>Ingen deltakere enda.</p>
            )}
          </div>
        </section>

        {/* Seksjon for selve gruppechatten */}
        <section className={styles.chatSection}>
          <h2>Chat</h2>

          {/* Meldingsliste */}
          <div className={styles.messages}>
            {groupData.messages?.length > 0 ? (
              groupData.messages.map((msg) => (
                <div key={msg.id} className={styles.messageCard}>
                  {/* Header på meldingen med bruker og tidspunkt */}
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

                  {/* Hvis meldingen er et bilde, vis bildet */}
                  {msg.message_type === "image" && msg.image_url ? (
                    <div className={styles.imageMessageWrap}>
                      <img
                        src={msg.image_url}
                        alt="Sendt bilde"
                        className={styles.chatImage}
                        onClick={() => setSelectedImage(msg.image_url)}
                      />
                      {/* Hvis meldingen også har tekst, vis teksten under bildet */}
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

            {/* Tomt element nederst som brukes for autoscroll */}
            <div ref={messagesEndRef} />
          </div>

          {/* Form for å sende melding */}
          <form onSubmit={handleSend} className={styles.form}>
            {/* Tekstfelt for melding */}
            <textarea
              className={styles.textarea}
              placeholder="Skriv en melding til gruppa..."
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

            {/* Rad for filopplasting */}
            <div className={styles.uploadRow}>
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />

              {/* Hvis et bilde er valgt, vis knapp for å fjerne det */}
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

            {/* Forhåndsvisning av valgt bilde før sending */}
            {imagePreview && (
              <div className={styles.previewWrap}>
                <img
                  src={imagePreview}
                  alt="Forhåndsvisning"
                  className={styles.previewImage}
                />
              </div>
            )}

            {/* Send-knapp */}
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

      {/* Modal for å vise bilde i større størrelse når man klikker på et chatbilde */}
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