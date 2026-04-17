"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ini = (name) => (String(name ?? "?")[0] ?? "?").toUpperCase();

// Avatar: shows profile image or initials fallback
function UserAvatar({ src, username, size = 40 }) {
  const [imgOk, setImgOk] = useState(!!src);
  useEffect(() => setImgOk(!!src), [src]);
  const initStyle = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    background: "var(--accent-bg)", border: "1px solid var(--accent)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 800, fontSize: Math.round(size * 0.38), color: "var(--accent)",
  };
  if (imgOk && src) {
    return (
      <Image src={src} alt={username}
        width={size}
        height={size}
        unoptimized
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        onError={() => setImgOk(false)} />
    );
  }
  return <div style={initStyle}>{ini(username)}</div>;
}

const relTime = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000)   return "Akkurat nå";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min siden`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} t siden`;
  return new Date(ts).toLocaleDateString("no-NO");
};

const NAV = [
  { id: "feed",    label: "Nyhetsstrøm", icon: "📰" },
  { id: "utforsk", label: "Utforsk",     icon: "🔍" },
  { id: "venner",  label: "Venner",      icon: "👥" },
  { id: "lagret",  label: "Lagret",      icon: "🔖" },
];

const TRENDING = [
  { name: "Jotunheimen",  count: 142 },
  { name: "Preikestolen", count: 97  },
  { name: "Trolltunga",   count: 213 },
  { name: "Besseggen",    count: 81  },
  { name: "Galdhøpiggen", count: 56  },
];

export default function SosialPage() {
  const router = useRouter();
  const [currentUser,   setCurrentUser]   = useState(null);
  const [myAvatar,      setMyAvatar]      = useState(null);
  const [posts,         setPosts]         = useState([]);
  const [users,         setUsers]         = useState([]);
  const [userAvatars,   setUserAvatars]   = useState({});
  const [caption,       setCaption]       = useState("");
  const [likedPosts,    setLikedPosts]    = useState(new Set());
  const [followedUsers, setFollowedUsers] = useState(new Set());
  const [followers,     setFollowers]     = useState(new Set());
  const [savedPosts,    setSavedPosts]    = useState(new Set());
  const [commentStates, setCommentStates] = useState({});
  const [activeTab,     setActiveTab]     = useState("feed");
  const [loading,       setLoading]       = useState(true);

  /* ── auth ── */
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        if (!d?.user) { router.push("/login"); return; }
        setCurrentUser(d.user);
      });
  }, [router]);

  /* ── my avatar ── */
  useEffect(() => {
    if (!currentUser?.id) return;
    fetch(`/api/get-avatar?userId=${currentUser.id}`)
      .then((r) => r.json().catch(() => ({})))
      .then((d) => setMyAvatar(d?.avatar || null));
  }, [currentUser?.id]);

  /* ── posts ── */
  const loadPosts = useCallback(async (userId) => {
    setLoading(true);
    const res  = await fetch(`/api/sosial/posts${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`);
    const data = await res.json().catch(() => []);
    const arr  = Array.isArray(data) ? data : [];
    setPosts(arr);
    setLikedPosts(new Set(arr.filter((p) => p.likedByCurrentUser).map((p) => p.postid)));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    loadPosts(currentUser.id);
  }, [currentUser, loadPosts]);

  /* ── users + their avatars ── */
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json().catch(() => []))
      .then((d) => {
        const arr = Array.isArray(d) ? d : [];
        setUsers(arr);
        arr.forEach((u) => {
          fetch(`/api/get-avatar?userId=${u.id}`)
            .then((r) => r.json().catch(() => ({})))
            .then((av) => {
              if (av?.avatar) setUserAvatars((prev) => ({ ...prev, [u.id]: av.avatar }));
            });
        });
      });
  }, []);

  /* ── follows ── */
  const loadFollows = useCallback(async (userId) => {
    const res  = await fetch(`/api/sosial/follows?userId=${userId}`);
    const data = await res.json().catch(() => ({ following: [], followers: [] }));
    setFollowedUsers(new Set((data.following ?? []).map(String)));
    setFollowers(new Set((data.followers ?? []).map(String)));
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    loadFollows(currentUser.id);
  }, [currentUser, loadFollows]);

  /* ── saved posts ── */
  const loadSavedPosts = useCallback(async (userId) => {
    const res  = await fetch(`/api/sosial/saves?userId=${userId}`);
    const data = await res.json().catch(() => []);
    setSavedPosts(new Set(Array.isArray(data) ? data.map(String) : []));
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    loadSavedPosts(currentUser.id);
  }, [currentUser, loadSavedPosts]);

  /* ── actions ── */
  async function submitPost() {
    if (!caption.trim() || !currentUser?.id) return;
    await fetch("/api/sosial/posts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ caption, userid: currentUser.id }),
    });
    setCaption("");
    loadPosts(currentUser.id);
  }

  async function toggleLike(postid, liked) {
    if (!currentUser?.id) return;
    await fetch("/api/sosial/likes", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ postid, userid: currentUser.id }),
    });
    setLikedPosts((prev) => {
      const next = new Set(prev);
      liked ? next.delete(postid) : next.add(postid);
      return next;
    });
    loadPosts(currentUser.id);
  }

  async function toggleFollow(targetId) {
    if (!currentUser?.id || String(targetId) === String(currentUser.id)) return;
    const isFollowing = followedUsers.has(String(targetId));
    setFollowedUsers((prev) => {
      const next = new Set(prev);
      isFollowing ? next.delete(String(targetId)) : next.add(String(targetId));
      return next;
    });
    await fetch("/api/sosial/follows", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ followerId: currentUser.id, followingId: targetId }),
    });
    loadFollows(currentUser.id);
  }

  async function toggleSave(postid) {
    if (!currentUser?.id) return;
    const isSaved = savedPosts.has(String(postid));
    setSavedPosts((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(String(postid)) : next.add(String(postid));
      return next;
    });
    await fetch("/api/sosial/saves", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userid: currentUser.id, postid }),
    });
  }

  function getCommentState(postid) {
    return commentStates[postid] ?? { open: false, comments: [], loading: false, text: "" };
  }

  function setCommentField(postid, updates) {
    setCommentStates((prev) => ({
      ...prev,
      [postid]: { ...(prev[postid] ?? { open: false, comments: [], loading: false, text: "" }), ...updates },
    }));
  }

  async function toggleComments(postid) {
    const cs = getCommentState(postid);
    const nowOpen = !cs.open;
    setCommentField(postid, { open: nowOpen });
    if (nowOpen && cs.comments.length === 0 && !cs.loading) {
      setCommentField(postid, { loading: true });
      const res  = await fetch(`/api/sosial/comments?postid=${postid}`);
      const data = await res.json().catch(() => []);
      setCommentField(postid, { comments: Array.isArray(data) ? data : [], loading: false });
    }
  }

  async function submitComment(postid) {
    const cs = getCommentState(postid);
    if (!cs.text.trim() || !currentUser?.id) return;
    const text = cs.text.trim();
    setCommentField(postid, { text: "" });
    const res       = await fetch("/api/sosial/comments", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ postid, userid: currentUser.id, content: text }),
    });
    const newComment = await res.json().catch(() => null);
    if (newComment?.commentid) {
      setCommentField(postid, { comments: [...getCommentState(postid).comments, newComment] });
      loadPosts(currentUser.id);
    }
  }

  function sharePost(postid) {
    const url = `${window.location.origin}/sosial#post-${postid}`;
    if (navigator.share) {
      navigator.share({ title: "Del innlegg", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => alert("Lenke kopiert!")).catch(() => {});
    }
  }

  const otherUsers     = users.filter((u) => String(u.id) !== String(currentUser?.id));
  const friendIds      = new Set([...followedUsers, String(currentUser?.id ?? "")]);
  const feedPosts      = posts.filter((p) => friendIds.has(String(p.userid)));
  const savedPostsList = posts.filter((p) => savedPosts.has(String(p.postid)));
  const followingUsers = users.filter((u) => followedUsers.has(String(u.id)));
  const followerUsers  = users.filter((u) => followers.has(String(u.id)));

  /* ── post card renderer ── */
  function renderPostCard(p, idx, showAd = true) {
    const liked     = likedPosts.has(p.postid);
    const saved     = savedPosts.has(String(p.postid));
    const name      = p.username ?? "Anonym";
    const cs        = getCommentState(p.postid);
    const avatarSrc = userAvatars[String(p.userid)] || null;
    return (
      <div key={p.postid}>
        {showAd && idx > 0 && idx % 4 === 0 && (
          <div style={{
            background: "var(--bg-panel)", border: "1px solid var(--border)",
            borderLeft: "3px solid var(--accent)", borderRadius: 4,
            padding: "1rem 1.25rem", marginBottom: "0.85rem",
          }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: "0.35rem" }}>Sponset</div>
            <div style={{ fontWeight: 800, fontSize: "0.92rem", marginBottom: "0.25rem" }}>Norlandia Hytter — Natur &amp; Ro på Fjelltoppen</div>
            <div style={{ fontSize: "0.83rem", color: "var(--text-muted)", marginBottom: "0.6rem" }}>Eksklusive fjellhytter med panoramautsikt. Spar 15 % denne uken.</div>
            <a href="/reserver" style={{ display: "inline-block", padding: "0.4rem 1rem", background: "var(--accent)", color: "#fff", borderRadius: 4, textDecoration: "none", fontWeight: 700, fontSize: "0.78rem" }}>Se pakker →</a>
          </div>
        )}
        <div id={`post-${p.postid}`} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, marginBottom: "0.85rem", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem 1.25rem 0.6rem" }}>
            <UserAvatar src={avatarSrc} username={name} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{name}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{relTime(p.timestamp)}</div>
            </div>
            {currentUser && String(p.userid) !== String(currentUser.id) && (
              <button
                onClick={() => toggleFollow(p.userid)}
                style={{
                  padding: "0.3rem 0.75rem",
                  background: followedUsers.has(String(p.userid)) ? "var(--accent)" : "transparent",
                  border: "1px solid var(--accent)", borderRadius: 4,
                  color: followedUsers.has(String(p.userid)) ? "#fff" : "var(--accent)",
                  fontSize: "0.73rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {followedUsers.has(String(p.userid)) ? "Følger ✓" : "Følg"}
              </button>
            )}
          </div>
          <div style={{ padding: "0 1.25rem 0.85rem", fontSize: "0.92rem", color: "var(--text)", lineHeight: 1.7 }}>
            {p.caption}
          </div>
          {(p.likes > 0 || p.comment_count > 0) && (
            <div style={{ padding: "0 1.25rem 0.4rem", fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "1rem" }}>
              {p.likes > 0 && <span>{p.likes} liker dette</span>}
              {p.comment_count > 0 && (
                <button
                  onClick={() => toggleComments(p.postid)}
                  style={{ background: "none", border: "none", padding: 0, color: "var(--text-muted)", fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}
                >
                  {p.comment_count} kommentar{p.comment_count !== 1 ? "er" : ""}
                </button>
              )}
            </div>
          )}
          <div style={{ height: 1, background: "var(--border)", margin: "0 1rem" }} />
          <div style={{ display: "flex" }}>
            <button
              onClick={() => toggleLike(p.postid, liked)}
              style={{ flex: 1, padding: "0.55rem", background: "transparent", border: "none", color: liked ? "#ef4444" : "var(--text-muted)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              {liked ? "❤️" : "🤍"} Liker
            </button>
            <button
              onClick={() => toggleComments(p.postid)}
              style={{ flex: 1, padding: "0.55rem", background: cs.open ? "var(--accent-bg)" : "transparent", border: "none", color: cs.open ? "var(--accent)" : "var(--text-muted)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              💬 {p.comment_count > 0 ? `${p.comment_count} ` : ""}Kommenter
            </button>
            <button
              onClick={() => sharePost(p.postid)}
              style={{ flex: 1, padding: "0.55rem", background: "transparent", border: "none", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              ↗ Del
            </button>
            <button
              onClick={() => toggleSave(p.postid)}
              style={{ flex: 1, padding: "0.55rem", background: "transparent", border: "none", color: saved ? "var(--accent)" : "var(--text-muted)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              {saved ? "🔖" : "📌"} Lagre
            </button>
          </div>
          {cs.open && (
            <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg)", padding: "0.75rem 1.25rem" }}>
              {cs.loading && (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", paddingBottom: "0.5rem" }}>Laster kommentarer...</div>
              )}
              {!cs.loading && cs.comments.length === 0 && (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", paddingBottom: "0.6rem" }}>Ingen kommentarer ennå.</div>
              )}
              {cs.comments.map((c) => (
                <div key={c.commentid} style={{ display: "flex", gap: "0.6rem", marginBottom: "0.6rem", alignItems: "flex-start" }}>
                  <UserAvatar src={userAvatars[String(c.userid)] || null} username={c.username} size={28} />
                  <div style={{ flex: 1, background: "var(--bg-panel)", borderRadius: 4, padding: "0.45rem 0.75rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.78rem" }}>{c.username || "Anonym"}</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text)", marginTop: "0.1rem" }}>{c.content}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>{relTime(c.created_at)}</div>
                  </div>
                </div>
              ))}
              {currentUser && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", alignItems: "center" }}>
                  <UserAvatar src={myAvatar} username={currentUser.username} size={28} />
                  <input
                    value={cs.text}
                    onChange={(e) => setCommentField(p.postid, { text: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(p.postid); } }}
                    placeholder="Skriv en kommentar…"
                    style={{
                      flex: 1, background: "var(--bg-panel)", border: "1px solid var(--border)",
                      borderRadius: 16, color: "var(--text)", fontSize: "0.82rem",
                      padding: "0.4rem 0.85rem", outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <button
                    onClick={() => submitComment(p.postid)}
                    disabled={!cs.text.trim()}
                    style={{
                      padding: "0.4rem 0.9rem",
                      background: cs.text.trim() ? "var(--accent)" : "var(--border)",
                      color: cs.text.trim() ? "#fff" : "var(--text-muted)",
                      border: "none", borderRadius: 16, fontWeight: 700, fontSize: "0.78rem",
                      cursor: cs.text.trim() ? "pointer" : "default", fontFamily: "inherit",
                    }}
                  >Send</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ════════════════════════ RENDER ════════════════════════ */
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", fontFamily: "'Inter','Poppins',sans-serif", color: "var(--text)" }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem 6rem",
        display: "grid", gridTemplateColumns: "240px 1fr 280px",
        gap: "1.25rem", alignItems: "start",
      }}>

        {/* ══════════ LEFT SIDEBAR ══════════ */}
        <aside style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: "0.75rem" }}>

          {/* Profile mini-card */}
          {currentUser && (
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: 54, background: "linear-gradient(135deg, var(--bg-panel) 0%, var(--accent-bg) 100%)" }} />
              <div style={{ padding: "0 1rem 1rem" }}>
                <div style={{ marginTop: -24, marginBottom: "0.5rem", width: 48, border: "3px solid var(--bg-panel)", borderRadius: "50%", boxSizing: "content-box", display: "inline-block" }}>
                  <UserAvatar src={myAvatar} username={currentUser.username} size={48} />
                </div>
                <div style={{ fontWeight: 800, fontSize: "0.92rem" }}>{currentUser.username || currentUser.email}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>FrittFram medlem</div>
                <a href="/profile" style={{
                  display: "block", marginTop: "0.75rem", padding: "0.5rem",
                  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4,
                  color: "var(--text-muted)", textDecoration: "none", fontWeight: 600, fontSize: "0.78rem", textAlign: "center",
                }}>Vis profil</a>
              </div>
            </div>
          )}

          {/* Nav */}
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
            {NAV.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.65rem",
                  width: "100%", padding: "0.75rem 1rem",
                  background: "transparent",
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  borderBottom: "none", borderRight: "none",
                  borderLeft: activeTab === item.id ? "3px solid var(--accent)" : "3px solid transparent",
                  color: activeTab === item.id ? "var(--text)" : "var(--text-muted)",
                  fontWeight: activeTab === item.id ? 700 : 500,
                  fontSize: "0.87rem", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}
              >
                <span style={{ fontSize: "1rem" }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* Quick links */}
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)" }}>
              <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>Snarveier</p>
            </div>
            {[
              { label: "Min profil",     href: "/profile"  },
              { label: "Reserver hytte", href: "/reserver" },
              { label: "Utforsk turer",  href: "/explore"  },
              { label: "Kart",           href: "/map"      },
              { label: "Vær",            href: "/vaer"     },
            ].map(({ label, href }, i, arr) => (
              <a key={href} href={href} style={{
                display: "block", padding: "0.65rem 1rem",
                borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                color: "var(--text-muted)", textDecoration: "none", fontSize: "0.83rem", fontWeight: 500,
              }}>{label}</a>
            ))}
          </div>
        </aside>

        {/* ══════════ MAIN CONTENT ══════════ */}
        <main style={{ minWidth: 0 }}>

          {/* ── FEED TAB ── */}
          {activeTab === "feed" && (
            <>
              {currentUser && (
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, padding: "1rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <UserAvatar src={myAvatar} username={currentUser.username} size={38} />
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder={`Hva tenker du på, ${currentUser.username || "deg"}?`}
                      style={{
                        flex: 1, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 4,
                        color: "var(--text)", fontSize: "0.9rem", padding: "0.65rem 0.9rem",
                        resize: "vertical", outline: "none", fontFamily: "inherit",
                        minHeight: 72, boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: "calc(38px + 0.75rem)" }}>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      {["📷 Bilde", "📍 Sted", "🏔️ Tur"].map((lbl) => (
                        <button key={lbl} style={{
                          padding: "0.3rem 0.65rem", background: "var(--bg)", border: "1px solid var(--border)",
                          borderRadius: 4, color: "var(--text-muted)", fontSize: "0.73rem", fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit",
                        }}>{lbl}</button>
                      ))}
                    </div>
                    <button
                      onClick={submitPost}
                      disabled={!caption.trim()}
                      style={{
                        padding: "0.5rem 1.25rem",
                        background: caption.trim() ? "var(--accent)" : "var(--border)",
                        color: caption.trim() ? "#fff" : "var(--text-muted)",
                        border: "none", borderRadius: 4, fontWeight: 800, fontSize: "0.82rem",
                        cursor: caption.trim() ? "pointer" : "default",
                        fontFamily: "inherit", transition: "all 0.15s",
                      }}
                    >Del</button>
                  </div>
                </div>
              )}
              {loading && (
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Laster innlegg...
                </div>
              )}
              {!loading && feedPosts.length === 0 && followedUsers.size === 0 && (
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, padding: "2.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>👥</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.4rem" }}>Ingen venner ennå</div>
                  <div style={{ fontSize: "0.83rem", color: "var(--text-muted)", marginBottom: "1rem" }}>Følg folk for å se innlegg fra dem her.</div>
                  <button onClick={() => setActiveTab("utforsk")} style={{
                    padding: "0.5rem 1.25rem", background: "var(--accent)", color: "#fff",
                    border: "none", borderRadius: 4, fontWeight: 700, fontSize: "0.82rem",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>Utforsk folk →</button>
                </div>
              )}
              {!loading && feedPosts.length === 0 && followedUsers.size > 0 && (
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Ingen innlegg fra deg eller de du følger ennå.
                </div>
              )}
              {feedPosts.map((p, idx) => renderPostCard(p, idx))}
            </>
          )}

          {/* ── UTFORSK TAB ── */}
          {activeTab === "utforsk" && (
            <>
              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, padding: "1rem 1.25rem", marginBottom: "1rem" }}>
                <div style={{ fontWeight: 800, fontSize: "1rem" }}>🔍 Utforsk</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Oppdag innlegg og folk fra hele FrittFram-samfunnet.</div>
              </div>
              {loading && (
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Laster innlegg...
                </div>
              )}
              {!loading && posts.length === 0 && (
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Ingen innlegg ennå — vær den første til å dele!
                </div>
              )}
              {posts.map((p, idx) => renderPostCard(p, idx))}
            </>
          )}

          {/* ── VENNER TAB ── */}
          {activeTab === "venner" && (
            <>
              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, marginBottom: "1rem", overflow: "hidden" }}>
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 800, fontSize: "0.97rem" }}>👥 Følger ({followingUsers.length})</div>
                </div>
                {followingUsers.length === 0 ? (
                  <div style={{ padding: "1.5rem 1.25rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Du følger ingen ennå. Gå til Utforsk for å finne folk!
                  </div>
                ) : (
                  followingUsers.map((u, i) => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1.25rem", borderBottom: i < followingUsers.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <UserAvatar src={userAvatars[String(u.id)] || null} username={u.username || u.email} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{u.username || u.email}</div>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Du følger</div>
                      </div>
                      <button
                        onClick={() => toggleFollow(u.id)}
                        style={{
                          padding: "0.35rem 0.9rem", background: "var(--accent)", border: "none", borderRadius: 4,
                          color: "#fff", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        }}
                      >Slutt å følge</button>
                    </div>
                  ))
                )}
              </div>

              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, marginBottom: "1rem", overflow: "hidden" }}>
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 800, fontSize: "0.97rem" }}>❤️ Følgere ({followerUsers.length})</div>
                </div>
                {followerUsers.length === 0 ? (
                  <div style={{ padding: "1.5rem 1.25rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Ingen følger deg ennå.
                  </div>
                ) : (
                  followerUsers.map((u, i) => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1.25rem", borderBottom: i < followerUsers.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <UserAvatar src={userAvatars[String(u.id)] || null} username={u.username || u.email} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{u.username || u.email}</div>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Følger deg</div>
                      </div>
                      <button
                        onClick={() => toggleFollow(u.id)}
                        style={{
                          padding: "0.35rem 0.9rem",
                          background: followedUsers.has(String(u.id)) ? "var(--accent)" : "transparent",
                          border: "1px solid var(--accent)", borderRadius: 4,
                          color: followedUsers.has(String(u.id)) ? "#fff" : "var(--accent)",
                          fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        }}
                      >{followedUsers.has(String(u.id)) ? "Følger ✓" : "Følg tilbake"}</button>
                    </div>
                  ))
                )}
              </div>

              {otherUsers.filter((u) => !followedUsers.has(String(u.id))).length > 0 && (
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.97rem" }}>🔍 Folk du kanskje kjenner</div>
                  </div>
                  {otherUsers.filter((u) => !followedUsers.has(String(u.id))).slice(0, 10).map((u, i, arr) => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1.25rem", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <UserAvatar src={userAvatars[String(u.id)] || null} username={u.username || u.email} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{u.username || u.email}</div>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Friluftsentusiast</div>
                      </div>
                      <button
                        onClick={() => toggleFollow(u.id)}
                        style={{
                          padding: "0.35rem 0.9rem",
                          background: "transparent", border: "1px solid var(--accent)", borderRadius: 4,
                          color: "var(--accent)", fontSize: "0.78rem", fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >Følg</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── LAGRET TAB ── */}
          {activeTab === "lagret" && (
            <>
              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, padding: "1rem 1.25rem", marginBottom: "1rem" }}>
                <div style={{ fontWeight: 800, fontSize: "1rem" }}>🔖 Lagret innhold</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Innlegg du har lagret.</div>
              </div>
              {loading ? (
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Laster...
                </div>
              ) : savedPostsList.length === 0 ? (
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, padding: "2.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔖</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.4rem" }}>Ingen lagrede innlegg</div>
                  <div style={{ fontSize: "0.83rem", color: "var(--text-muted)" }}>Trykk 📌 Lagre på et innlegg for å lagre det her.</div>
                </div>
              ) : (
                savedPostsList.map((p, idx) => renderPostCard(p, idx, false))
              )}
            </>
          )}

        </main>

        {/* ══════════ RIGHT SIDEBAR ══════════ */}
        <aside style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: "0.75rem" }}>

          {/* People on FrittFram */}
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
              <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>Brukere på FrittFram</p>
            </div>
            {otherUsers.slice(0, 6).map((u, i, arr) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.7rem 1rem", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                <UserAvatar src={userAvatars[String(u.id)] || null} username={u.username || u.email} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.username || u.email}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    {followedUsers.has(String(u.id)) ? "Du følger" : "Friluftsentusiast"}
                  </div>
                </div>
                <button
                  onClick={() => toggleFollow(u.id)}
                  style={{
                    padding: "0.28rem 0.65rem",
                    background: followedUsers.has(String(u.id)) ? "var(--accent)" : "var(--bg)",
                    border: "1px solid var(--accent)", borderRadius: 4,
                    color: followedUsers.has(String(u.id)) ? "#fff" : "var(--accent)",
                    fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                  }}
                >
                  {followedUsers.has(String(u.id)) ? "Følger" : "Følg"}
                </button>
              </div>
            ))}
          </div>

          {/* Trending */}
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
              <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>Trending i dag</p>
            </div>
            {TRENDING.map(({ name, count }, i, arr) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.65rem 1rem", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--text-muted)", minWidth: 18, textAlign: "right" }}>#{i + 1}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{count} innlegg</div>
                </div>
              </div>
            ))}
          </div>

          {/* Sponsored sidebar */}
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)", borderRadius: 4, padding: "1rem" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: "0.4rem" }}>Sponset</div>
            <div style={{ fontWeight: 800, fontSize: "0.88rem", marginBottom: "0.25rem" }}>Norlandia Hytter</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.65rem", lineHeight: 1.55 }}>Spar 15 % på alle fjellhytter denne uken.</div>
            <a href="/reserver" style={{ display: "block", padding: "0.5rem", background: "var(--accent)", color: "#fff", borderRadius: 4, textDecoration: "none", fontWeight: 700, fontSize: "0.78rem", textAlign: "center" }}>
              Se pakker →
            </a>
          </div>

        </aside>
      </div>
    </div>
  );
}

