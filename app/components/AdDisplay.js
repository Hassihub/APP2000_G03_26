"use client";

import { useEffect, useRef } from "react";

export default function AdDisplay({ ad, placement }) {
  const containerRef = useRef(null);
  const impressionTracked = useRef(false);

  useEffect(() => {
    // Track impression once when component is visible
    const trackImpression = async () => {
      if (impressionTracked.current) return;

      try {
        await fetch(`/api/advertisements/${ad.id}/impression`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page_url: typeof window !== "undefined" ? window.location.href : "",
          }),
        });

        impressionTracked.current = true;
      } catch (error) {
        console.error("Failed to track impression:", error);
      }
    };

    // Use Intersection Observer to track when ad enters viewport
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          trackImpression();
        }
      },
      { threshold: 0.5 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [ad.id]);

  const handleClick = async () => {
    try {
      await fetch(`/api/advertisements/${ad.id}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }),
      });
    } catch (error) {
      console.error("Failed to track click:", error);
    }

    // Redirect after tracking
    window.open(ad.url, "_blank");
  };

  // Styling based on placement
  const placementStyles = {
    right_sidebar: {
      container: { width: "100%", minWidth: "300px" },
      image: { width: "100%", height: "auto" },
    },
    left_sidebar: {
      container: { width: "100%", minWidth: "300px" },
      image: { width: "100%", height: "auto" },
    },
    top_banner: {
      container: { width: "100%" },
      image: { width: "100%", height: "120px", objectFit: "cover" },
    },
    mid_page_banner: {
      container: { width: "100%", margin: "2rem 0" },
      image: { width: "100%", height: "300px", objectFit: "cover" },
    },
  };

  const style = placementStyles[ad.placement] || placementStyles.right_sidebar;

  return (
    <div
      ref={containerRef}
      style={{
        ...style.container,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "0.5rem",
        overflow: "hidden",
        cursor: "pointer",
        transition: "box-shadow 0.3s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
      onClick={handleClick}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.15)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)")}
      role="button"
      tabIndex={0}
    >
      {ad.image_url && (
        <img
          src={ad.image_url}
          alt={ad.title}
          style={{
            ...style.image,
            display: "block",
            borderRadius: "4px",
            marginBottom: "0.5rem",
          }}
        />
      )}

      <div style={{ padding: "0.5rem" }}>
        <h4
          style={{
            margin: "0 0 0.3rem 0",
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1.3,
          }}
        >
          {ad.title}
        </h4>

        <p
          style={{
            margin: "0 0 0.5rem 0",
            fontSize: "0.85rem",
            color: "#6b7280",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {ad.description}
        </p>

        <button
          style={{
            width: "100%",
            padding: "0.5rem",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
        >
          Les mer →
        </button>
      </div>

      {/* Ad label */}
      <div
        style={{
          position: "absolute",
          top: "0.25rem",
          right: "0.25rem",
          background: "#fbbf24",
          color: "#78350f",
          padding: "0.25rem 0.5rem",
          fontSize: "0.7rem",
          fontWeight: 700,
          borderRadius: "3px",
        }}
      >
        ANNONSE
      </div>
    </div>
  );
}
