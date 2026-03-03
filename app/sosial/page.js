"use client";

import { useState } from "react";

export default function Sosial() {
  const [posts, setPosts] = useState([
    {
      id: 1,
      user: "Marius Nordli",
      avatar: "/images/avatar1.jpg",
      content: "Så glad for å dele min første opplevelse her! #bærekraft",
      likes: 12,
      comments: 3,
    },
    {
      id: 2,
      user: "Hasnain Malik",
      avatar: "/images/avatar2.jpg",
      content: "Helt enig med innlegget over. Vi må tenke grønt 🌱",
      likes: 8,
      comments: 2,
    },
  ]);

  return (
    <div style={{ padding: "2rem", fontFamily: "'Inter', sans-serif", backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1.5rem" }}>Sosial</h1>
      <p style={{ fontSize: "1rem", color: "#555", marginBottom: "2rem" }}>
        Koble deg med andre og del opplevelser her.
      </p>

      {/* Nytt innlegg */}
      <div style={{
        display: "flex", flexDirection: "column", marginBottom: "2rem",
        border: "1px solid #ddd", borderRadius: "0px", padding: "1rem", backgroundColor: "#fff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
      }}>
        <textarea
          placeholder="Hva tenker du på?" 
          style={{
            width: "100%", padding: "0.75rem", fontSize: "1rem", borderRadius: "0px", border: "1px solid #ccc",
            resize: "none", outline: "none"
          }}
          rows={3}
        />
        <button style={{
          alignSelf: "flex-end", marginTop: "0.5rem", padding: "0.5rem 1rem",
          background: "linear-gradient(135deg, #4ade80, #16a34a)", border: "none", borderRadius: "0px",
          color: "#fff", fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          Del
        </button>
      </div>

      {/* Liste over innlegg */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {posts.map(post => (
          <div key={post.id} style={{
            backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "0px",
            padding: "1rem", boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
          }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
              <img src={post.avatar} alt={post.user} style={{ width: "40px", height: "40px", borderRadius: "50%", marginRight: "0.75rem" }} />
              <span style={{ fontWeight: 600 }}>{post.user}</span>
            </div>
            <p style={{ marginBottom: "0.75rem" }}>{post.content}</p>
            <div style={{ display: "flex", gap: "1rem", fontSize: "0.9rem", color: "#555" }}>
              <span>👍 {post.likes}</span>
              <span>💬 {post.comments}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}