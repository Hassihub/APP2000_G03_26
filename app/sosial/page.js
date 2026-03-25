"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import DelKnapp from "./post_buttons/DelKnapp.png"
import KommentarKnapp from "./post_buttons/KommentarKnapp.png"
import LikerKnappAv from "./post_buttons/LikerKnappAv.png"
import LikerKnappPaa from "./post_buttons/LikerKnappPaa.png"



export default function SosialPage() {
  const [posts, setPosts] = useState([])
  const [caption, setCaption] = useState("")
  const [likedPosts, setLikedPosts] = useState(new Set())

  async function loadPosts() {
    const res = await fetch("/api/sosial/posts")
    setPosts(await res.json())
  }

  useEffect(() => {
    loadPosts()
  }, [])

  async function submitPost() {
    if (!caption.trim()) return

    await fetch("/api/sosial/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postid,
        userid: "00000000-0000-0000-0000-000000000000"
      })
    })

    setCaption("")
    loadPosts()
  }

  async function toggleLike(postid, liked) {
  await fetch("/api/sosial/likes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postid,
      userid: "00000000-0000-0000-0000-000000000000" //MÅ byttes ut med userid
    })
  })

    setLikedPosts(prev => {
      const next = new Set(prev)
      liked ? next.delete(postid) : next.add(postid)
      return next
    })

    loadPosts()
  }

  function sharePost(postid) {
    const url = `${window.location.origin}/sosial#post-${postid}`

    if (navigator.share) {
      navigator.share({ url })
    } else {
      navigator.clipboard.writeText(url)
      alert("link copied")
    }
  }

  return (
    <div>
      <h1>sosial</h1>

      <textarea
        value={caption}
        onChange={e => setCaption(e.target.value)}
        placeholder="posts"
      />

      <button onClick={submitPost}>post</button>

      {posts.map(p => {
        const liked = likedPosts.has(p.postid)

        return (
          <div key={p.postid} id={`post-${p.postid}`}>
            <p>{p.caption}</p>
            <small>
              {new Date(p.timestamp).toISOString()}
            </small>
            <div>likes: {p.likes}</div>

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
