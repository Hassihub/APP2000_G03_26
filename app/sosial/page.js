"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTranslations } from "../components/LanguageProvider"
import DelKnapp from "./post_buttons/DelKnapp.png"
import KommentarKnapp from "./post_buttons/KommentarKnapp.png"
import LikerKnappAv from "./post_buttons/LikerKnappAv.png"
import LikerKnappPaa from "./post_buttons/LikerKnappPaa.png"



export default function SosialPage() {
  const router = useRouter()
  const t = useTranslations("socialPage")
  const [currentUser, setCurrentUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [caption, setCaption] = useState("")
  const [likedPosts, setLikedPosts] = useState(new Set())
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadCurrentUser() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
        })

        if (res.status === 401) {
          router.push("/login")
          return
        }

        const data = await res.json()
        if (!cancelled) {
          setCurrentUser(data.user)
        }
      } catch {
        if (!cancelled) {
          setError(t.currentUserError)
        }
      }
    }

    loadCurrentUser()

    return () => {
      cancelled = true
    }
  }, [router, t.currentUserError])

  const loadPosts = useCallback(async (userId) => {
    const suffix = userId
      ? `?userId=${encodeURIComponent(userId)}`
      : ""

    const res = await fetch(`/api/sosial/posts${suffix}`)
    const data = await res.json()

    setPosts(Array.isArray(data) ? data : [])
    setLikedPosts(
      new Set(
        (Array.isArray(data) ? data : [])
          .filter((post) => post.likedByCurrentUser)
          .map((post) => post.postid)
      )
    )
  }, [])

  useEffect(() => {
    if (!currentUser?.id) return

    loadPosts(currentUser.id)
  }, [currentUser, loadPosts])

  async function submitPost() {
    if (!caption.trim()) return
    if (!currentUser?.id) return

    const res = await fetch("/api/sosial/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption,
        userid: currentUser.id,
      })
    })

    if (!res.ok) {
      setError(t.publishError)
      return
    }

    setCaption("")
    loadPosts(currentUser.id)
  }

  async function toggleLike(postid, liked) {
    if (!currentUser?.id) return

    const res = await fetch("/api/sosial/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postid,
        userid: currentUser.id,
      })
    })

    if (!res.ok) {
      setError(t.likeError)
      return
    }

    setLikedPosts(prev => {
      const next = new Set(prev)
      liked ? next.delete(postid) : next.add(postid)
      return next
    })

    loadPosts(currentUser.id)
  }

  function sharePost(postid) {
    const url = `${window.location.origin}/sosial#post-${postid}`

    if (navigator.share) {
      navigator.share({ url })
    } else {
      navigator.clipboard.writeText(url)
      alert(t.shareCopied)
    }
  }

  return (
    <div>
      <h1>{t.title}</h1>

      {error ? <p style={{ color: "red" }}>{error}</p> : null}

      <textarea
        value={caption}
        onChange={e => setCaption(e.target.value)}
        placeholder={t.captionPlaceholder}
      />

      <button onClick={submitPost}>{t.publish}</button>

      {posts.map(p => {
        const liked = likedPosts.has(p.postid)

        return (
          <div key={p.postid} id={`post-${p.postid}`}>
            <p>{p.caption}</p>
            <small>
              {new Date(p.timestamp).toISOString()}
            </small>
            <div>{t.likes}: {p.likes}</div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => console.log("comments")}>
                <Image src={KommentarKnapp} alt="Kommentar" width={24} height={24} />
              </button>


              {liked ? (
                <button onClick={() => toggleLike(p.postid, true)}>
                  <Image src={LikerKnappPaa} alt="Liker Paa" width={24} height={24} />
                </button>
              ) : (
                <button onClick={() => toggleLike(p.postid, false)}>
                  <Image src={LikerKnappAv} alt="Liker Av" width={24} height={24} />
                </button>
              )}

              <button onClick={() => sharePost(p.postid)}>
                <Image src={DelKnapp} alt="Del" width={24} height={24} />
              </button>

            </div>
          </div>
        )
      })}
    </div>
  );
}
