"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "./LanguageProvider";
import KommentarKnapp from "../sosial/post_buttons/KommentarKnapp.png";
import LikerKnappAv from "../sosial/post_buttons/LikerKnappAv.png";
import LikerKnappPaa from "../sosial/post_buttons/LikerKnappPaa.png";

// embedded=true → compact mode for home page slide 3 (no page bg, limited height)
export default function SosialFeed({ embedded = false, currentUser: userProp = null }) {
  const t = useTranslations("socialPage");
  const [currentUser, setCurrentUser] = useState(userProp);
  const [posts, setPosts] = useState([]);
  const [caption, setCaption] = useState("");
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [error, setError] = useState("");

  // If not supplied via prop, load from API
  useEffect(() => {
    if (userProp) { setCurrentUser(userProp); return; }
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => { if (!cancelled) setCurrentUser(d?.user || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userProp]);

  const loadPosts = useCallback(async (userId) => {
    const suffix = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await fetch(`/api/sosial/posts${suffix}`);
    const data = await res.json();
    setPosts(Array.isArray(data) ? data : []);
    setLikedPosts(
      new Set(
        (Array.isArray(data) ? data : [])
          .filter((post) => post.likedByCurrentUser)
          .map((post) => post.postid)
      )
    );
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    loadPosts(currentUser.id);
  }, [currentUser, loadPosts]);

  async function submitPost() {
    if (!caption.trim() || !currentUser?.id) return;
    const res = await fetch("/api/sosial/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption, userid: currentUser.id }),
    });
    if (!res.ok) { setError(t.publishError); return; }
    setCaption("");
    loadPosts(currentUser.id);
  }

  async function toggleLike(postid, liked) {
    if (!currentUser?.id) return;
    const res = await fetch("/api/sosial/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postid, userid: currentUser.id }),
    });
    if (!res.ok) { setError(t.likeError); return; }
    setLikedPosts((prev) => {
      const next = new Set(prev);
      liked ? next.delete(postid) : next.add(postid);
      return next;
    });
    loadPosts(currentUser.id);
  }

  function sharePost(postid) {
    const url = `${window.location.origin}/sosial#post-${postid}`;
    if (navigator.share) { navigator.share({ url }); }
    else { navigator.clipboard.writeText(url); alert(t.shareCopied); }
  }

  const S = {
    composeBox: {
      background: "var(--bg-panel)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: "1.25rem",
      marginBottom: "1.5rem",
    },
    textarea: {
      width: "100%",
      minHeight: embedded ? 60 : 90,
      background: "var(--bg-input)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      color: "var(--text)",
      fontSize: "0.95rem",
      padding: "0.75rem 1rem",
      resize: "vertical",
      outline: "none",
      fontFamily: "inherit",
      boxSizing: "border-box",
    },
    publishBtn: {
      marginTop: "0.65rem",
      padding: "0.6rem 1.4rem",
      background: "var(--accent)",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      fontWeight: 700,
      fontSize: "0.85rem",
      cursor: "pointer",
    },
    errorMsg: {
      background: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.3)",
      color: "#dc2626",
      padding: "0.75rem 1rem",
      borderRadius: 10,
      marginBottom: "1rem",
      fontSize: "0.88rem",
    },
    postCard: {
      background: "var(--card-bg)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: "1.1rem 1.25rem",
      marginBottom: "0.85rem",
      boxShadow: "var(--shadow)",
    },
    postHeader: { display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.65rem" },
    avatar: {
      width: 36, height: 36, borderRadius: "50%",
      background: "var(--bg-panel)",
      border: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--text-muted)", fontWeight: 700, fontSize: "0.9rem", flexShrink: 0,
    },
    postUser: { fontWeight: 700, color: "var(--text)", fontSize: "0.9rem" },
    postTime: { color: "var(--text-dim)", fontSize: "0.75rem" },
    postBody: { color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "0.8rem", fontSize: "0.9rem" },
    postActions: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
    actionBtn: {
      display: "flex", alignItems: "center", gap: 5,
      background: "var(--bg-input)", border: "1px solid var(--border)",
      color: "var(--text-muted)", borderRadius: 8, padding: "0.4rem 0.8rem",
      cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
    },
    actionBtnLiked: {
      background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.4)", color: "#dc2626",
    },
    adCard: {
      background: "var(--accent-bg)",
      border: "1px solid var(--border)",
      borderRadius: 16, padding: "1.1rem", marginBottom: "0.85rem",
    },
  };

  const AD_CARD = (
    <div style={S.adCard}>
      <div style={{ display: "inline-block", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)", background: "var(--accent-bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.15rem 0.5rem", marginBottom: "0.6rem" }}>
        Betalt plassering
      </div>
      <div style={{ color: "var(--text)", fontWeight: 800, fontSize: "1rem", marginBottom: "0.3rem" }}>
        Norlandia Hytter — Natur & Ro på Fjelltoppen
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.55, marginBottom: "0.75rem" }}>
        Eksklusive fjellhytter med panoramautsikt. Spar 15 % denne uken.
      </div>
      <a href="/reserver" style={{ display: "inline-block", padding: "0.5rem 1.1rem", background: "var(--accent)", color: "#fff", borderRadius: 7, textDecoration: "none", fontWeight: 700, fontSize: "0.8rem" }}>
        Se pakker →
      </a>
    </div>
  );

  const feedItems = [];
  posts.forEach((p, idx) => {
    feedItems.push({ type: "post", data: p });
    if ((idx + 1) % 3 === 0) feedItems.push({ type: "ad" });
  });

  const relTime = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return "Akkurat nå";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min siden`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} t siden`;
    return new Date(ts).toLocaleDateString("no-NO");
  };

  const guestPrompt = !currentUser && (
    <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem 0", fontSize: "0.9rem" }}>
      <a href="/login" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>Logg inn</a> for å se og delta i forumet.
    </div>
  );

  return (
    <div>
      {error ? <div style={S.errorMsg}>{error}</div> : null}

      {currentUser ? (
        <div style={S.composeBox}>
          <textarea
            style={S.textarea}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t.captionPlaceholder}
          />
          <button style={S.publishBtn} onClick={submitPost}>{t.publish}</button>
        </div>
      ) : guestPrompt}

      {feedItems.map((item, i) => {
        if (item.type === "ad") return <div key={`ad-${i}`}>{AD_CARD}</div>;
        const p = item.data;
        const liked = likedPosts.has(p.postid);
        const initials = (p.username ?? "?")[0].toUpperCase();
        return (
          <div key={p.postid} id={`post-${p.postid}`} style={S.postCard}>
            <div style={S.postHeader}>
              <div style={S.avatar}>{initials}</div>
              <div>
                <div style={S.postUser}>{p.username ?? "Anonym"}</div>
                <div style={S.postTime}>{relTime(p.timestamp)}</div>
              </div>
            </div>
            <div style={S.postBody}>{p.caption}</div>
            <div style={S.postActions}>
              <button style={S.actionBtn}>
                <Image src={KommentarKnapp} alt="Kommentar" width={15} height={15} />
                Kommenter
              </button>
              <button
                style={{ ...S.actionBtn, ...(liked ? S.actionBtnLiked : {}) }}
                onClick={() => toggleLike(p.postid, liked)}
              >
                <Image src={liked ? LikerKnappPaa : LikerKnappAv} alt="Lik" width={15} height={15} />
                {p.likes} Liker
              </button>
              <button style={S.actionBtn} onClick={() => sharePost(p.postid)}>
                <Image src={DelKnapp} alt="Del" width={15} height={15} />
                Del
              </button>
            </div>
          </div>
        );
      })}

      {currentUser && posts.length === 0 ? (
        <div style={{ color: "#6b7280", textAlign: "center", padding: "2rem 0", fontSize: "0.9rem" }}>
          Ingen innlegg ennå. Vær den første til å dele!
        </div>
      ) : null}
    </div>
  );
}
