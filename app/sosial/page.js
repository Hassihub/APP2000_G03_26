"use client"

import { useEffect, useState } from "react"
import { SimpleFileUpload } from "simple-file-upload-react"
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
  const [imageUrl, setImageUrl] = useState("")
  const [uploadPublicKey, setUploadPublicKey] = useState("")
  const [uploadStatus, setUploadStatus] = useState("")

async function loadPosts() {
  try {
    const res = await fetch("/api/sosial/posts")

    const data = await res.json()

    if (!res.ok) {
      console.error("Failed to load posts:", data.error)
      return
    }

    setPosts(data)
  } catch (err) {
    console.error("loadPosts crashed:", err)
  }
}

async function loadComments(postid) {
  try {
    const res = await fetch(`/api/sosial/comments?postid=${postid}`)

    const data = await res.json()

    if (!res.ok) {
      console.error("Failed to load comments:", data.error)
      return
    }

    setComments(prev => ({
      ...prev,
      [postid]: data
    }))
  } catch (err) {
    console.error("loadComments crashed:", err)
  }
}

async function submitComment(postid) {
  const text = newComment[postid]
  if (!text?.trim()) return

  const res = await fetch("/api/sosial/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postid,
      comment: text,
    })
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error("Failed to submit comment:", errorText)
    return
  }

  setNewComment(prev => ({ ...prev, [postid]: "" }))
  loadComments(postid)
}

  useEffect(() => {
    loadPosts()
  }, [])

 useEffect(() => {
  let alive = true

  async function loadUploadPublicKey() {
    try {
      const res = await fetch("/api/simple-file-upload/public-key", {
        method: "GET",
        cache: "no-store",
      })

      if (!res.ok) {
        const text = await res.text()
        console.error("Failed to load Simple File Upload key:", text)
        return
      }

      if (!alive) return

      const data = await res.json()
      const key = typeof data?.publicKey === "string" ? data.publicKey.trim() : ""

      if (key && alive) {
        setUploadPublicKey(key)
      }
    } catch (err) {
      console.error("loadUploadPublicKey crashed:", err)
      if (alive) setUploadPublicKey("")
    }
  }

  loadUploadPublicKey()

  return () => {
    alive = false
  }
}, [])

async function submitPost() {
  if (!caption.trim()) return

  try {
    const res = await fetch("/api/sosial/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption,
        imageUrl
      })
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("Post creation failed:", data.error)
      return
    }

    setCaption("")
    setImageUrl("")
    setUploadStatus("")
    loadPosts()
  } catch (err) {
    console.error("submitPost crashed:", err)
  }
}

async function toggleLike(postid) {
  try {
    const res = await fetch("/api/sosial/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postid })
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("Failed to toggle like:", data.error)
      return
    }

    loadPosts()
  } catch (err) {
    console.error("toggleLike crashed:", err)
  }
}

  function sharePost(postid) {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/sosial#post-${postid}`

      if (navigator.share) {
        navigator.share({ url })
      } else {
        navigator.clipboard.writeText(url)
        alert("link copied")
      }
    } else {
      console.warn("sharePost called on server-side; window is not defined.")
    }
  }

  function handleImageUploadChange(event) {
    // SimpleFileUpload returns an object with cdnUrl for single file uploads
    const url = event?.cdnUrl || ""
    if (!url) return

    setImageUrl(url)
    setUploadStatus("Bilde lastet opp.")
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
      

      {uploadPublicKey ? (
        <SimpleFileUpload
          publicKey={uploadPublicKey}
          multiple={false}
          maxFileSize={5 * 1024 * 1024}
          onChange={handleImageUploadChange}
        />
        ) : (
          <p>Missing key for SimpleFileUpload</p>
        )}

      <button onClick={submitPost} className="buttonPost">post</button>
      </div>

      {posts.map(p => {
        const liked = p.liked
        

    

        return (
          <div key={p.postid} id={`post-${p.postid}`} className="post">
            <p>{p.caption}</p>
              {p.image && (
              <Image
                src={p.image}
                alt={p.caption ? `Bilde til innlegg: ${p.caption.slice(0, 40)}` : "Innleggsbilde"}
                width={300}
                height={300}
                unoptimized
                style={{ width: "300px", height: "auto" }}
              />
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
                <button onClick={() => toggleLike(p.postid)}>
                  <Image src={LikerKnappPaa} alt="Liker Paa" width={24} height={24} className="test"/>
                </button>
              ) : (
                <button onClick={() => toggleLike(p.postid)}>
                  <Image src={LikerKnappAv} alt="Liker Av" width={24} height={24} className="test" />
                </button>
              )}

              <button onClick={() => sharePost(p.postid)}>
                <Image src={DelKnapp} alt="Del" width={24} height={24} className="test"/>
              </button>

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
        )
      })}
    </div>
  );
}
