"use client";

import { useEffect, useState } from "react"
import Image from "next/image"
import DelKnapp from "./post_buttons/DelKnapp.png"
import KommentarKnapp from "./post_buttons/KommentarKnapp.png"
import LikerKnappAv from "./post_buttons/LikerKnappAv.png"
import LikerKnappPaa from "./post_buttons/LikerKnappPaa.png"
import "./sosial.css"



export default function SosialPage() {
  const [posts, setPosts] = useState([])
  const [caption, setCaption] = useState("")
  const [comments, setComments] = useState({})
  const [showComments, setShowComments] = useState({})
  const [newComment, setNewComment] = useState({})
  const [image, setImage] = useState(null)

  async function loadPosts() {
    const res = await fetch("/api/sosial/posts")
    setPosts(await res.json())
  }

  async function loadComments(postid) {
  const res = await fetch(`/api/sosial/comments?postid=${postid}`)
  const data = await res.json()

  setComments(prev => ({
    ...prev,
    [postid]: data
  }))
}

async function submitComment(postid) {
  const text = newComment[postid]
  if (!text?.trim()) return

  await fetch("/api/sosial/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postid,
      comment: text,
    })
  })

  setNewComment(prev => ({ ...prev, [postid]: "" }))
  loadComments(postid)
}

  useEffect(() => {
    if (!currentUser?.id) return;
    loadSavedPosts(currentUser.id);
  }, [currentUser, loadSavedPosts]);

  /* ── actions ── */
  async function submitPost() {
  if (!caption.trim()) return

  const formData = new FormData()
  formData.append("caption", caption)
  formData.append("image", image)

  await fetch("/api/sosial/posts", {
    method: "POST",
    body: formData
  })

  setCaption("")
  setImage(null)
  loadPosts()
}

  async function toggleLike(postid, liked) {
  await fetch("/api/sosial/likes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postid,
      userid: "00000000-0000-0000-0000-000000000000" //MÅ byttes ut med userid?
    })
  })
  
    loadPosts()
  }

  function sharePost(postid) {
    const url = `${window.location.origin}/sosial#post-${postid}`;
    if (navigator.share) {
      navigator.share({ title: "Del innlegg", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => alert("Lenke kopiert!")).catch(() => {});
    }
  }

  return (
    <div className="sosial-container">
      <h1>sosial</h1>

      <div className="post-box">
      <textarea
        value={caption}
        onChange={e => setCaption(e.target.value)}
        placeholder="Skriv ditt innlegg her!"
      />
      

      <input
      type="file"
      accept="image/*"
      onChange={e => setImage(e.target.files[0])}
      />

      <button onClick={submitPost} className="buttonPost">post</button>
      </div>

      {posts.map(p => {
        console.log(p)
        const liked = p.liked
        

    

        return (
          <div key={p.postid} id={`post-${p.postid}`} className="post">
            <p>{p.caption}</p>
              {p.image && (
              <img src={p.image} style={{ width: "300px" }} />
               )}
               <div className="post-header">
            <small>
              {new Date(p.timestamp).toISOString()}
            </small>
            </div>
            <div>likes: {p.likes}</div>

            <div className="post-actions">
              <button onClick={() => {
                    setShowComments(prev => ({
                      ...prev,
                      [p.postid]: !prev[p.postid]
                    }))

                    if (!comments[p.postid]) {
                      loadComments(p.postid)
                    }
                  }}>
                <Image src={KommentarKnapp} alt="Kommentar" width={24} height={24} className="test"/>
              </button>


              {liked ? (
                <button onClick={() => toggleLike(p.postid, true)}>
                  <Image src={LikerKnappPaa} alt="Liker Paa" width={24} height={24} className="test"/>
                </button>
              ) : (
                <button onClick={() => toggleLike(p.postid, false)}>
                  <Image src={LikerKnappAv} alt="Liker Av" width={24} height={24} className="test" />
                </button>
              )}

              <button onClick={() => sharePost(p.postid)}>
                <Image src={DelKnapp} alt="Del" width={24} height={24} className="test"/>
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
                {showComments[p.postid] && (
            <div>
              
              <div className="comments">
                {(comments[p.postid] || []).map(c => (
            <div key={c.commentid} className="comment">
              <strong>{c.username}</strong>: {c.comment}
            </div>
              ))}
              </div>
            <div className="comment-input">
              <input
                value={newComment[p.postid] || ""}
                onChange={e =>
                  setNewComment(prev => ({
                    ...prev,
                    [p.postid]: e.target.value
                  }))
                }
                placeholder="write comment"
              />
              </div>
                <button onClick={() => submitComment(p.postid)} className="buttonSend">
                  send
                </button>
              </div>
                )}
            
          </div>

        </aside>
      </div>
    </div>
  );
}

