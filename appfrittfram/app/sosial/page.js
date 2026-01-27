import React from "react";

export default function SocialMediaFeedSection() {
  const posts = Array.from({ length: 6 });

  const containerStyle = {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    display: "flex",
    justifyContent: "center",
    padding: "4rem 0",
  };

  const feedStyle = {
    width: "100%",
    maxWidth: 420,
    display: "grid",
    rowGap: 40,
    padding: "0 16px",
  };

  const cardStyle = {
    background: "#000",
    border: "1px solid #18181b",
    borderRadius: 20,
    overflow: "hidden",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
  };

  const avatarStyle = {
    height: 36,
    width: 36,
    borderRadius: "50%",
    background: "#374151",
    flex: "0 0 36px",
  };

  const imageStyle = {
    width: "100%",
    aspectRatio: "1 / 1",
    background: "#27272a",
  };

  const actionsStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    color: "#a1a1aa",
  };

  const captionStyle = {
    padding: "0 16px 16px 16px",
    fontSize: 14,
    color: "#a1a1aa",
  };

  return (
    <div style={containerStyle}>
      <div style={feedStyle}>
        {posts.map((_, i) => (
          <div key={i} style={cardStyle}>
            <div style={headerStyle}>
              <div style={avatarStyle} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>username</span>
            </div>

            <div style={imageStyle} />

            <div style={actionsStyle}>
              <div style={{ display: "flex", gap: 12 }}>
                <button aria-label="like" title="Like" style={{ background: "none", border: "none", color: "inherit", padding: 6 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20.8 7.2c0 5.2-8.8 11-8.8 11S3.2 12.4 3.2 7.2A4 4 0 0 1 7.2 3.2c1.6 0 3 0.9 3.6 2.2.6-1.3 2-2.2 3.6-2.2a4 4 0 0 1 4 4z" />
                  </svg>
                </button>
                <button aria-label="comment" title="Comment" style={{ background: "none", border: "none", color: "inherit", padding: 6 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
                <button aria-label="share" title="Share" style={{ background: "none", border: "none", color: "inherit", padding: 6 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 12v7a1 1 0 0 0 1.5.86L12 17l6.5 2.86A1 1 0 0 0 20 19v-7" />
                    <path d="M12 3v12" />
                    <path d="M7 8l5-5 5 5" />
                  </svg>
                </button>
              </div>
              <button aria-label="bookmark" title="Save" style={{ background: "none", border: "none", color: "inherit", padding: 6 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            </div>

            <div style={captionStyle}>
              <span style={{ fontWeight: 600, color: "#fff" }}>username</span> this is a caption placeholder because vibes content
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
