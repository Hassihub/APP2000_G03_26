"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import styles from "./TripImageCarousel.module.css";

export default function TripImageCarousel({ images, altBase }) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const prev = () => setCurrent((c) => (c === 0 ? images.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === images.length - 1 ? 0 : c + 1));

  const openLightbox = () => {
    setLightboxIndex(current);
    setLightboxOpen(true);
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft")
        setLightboxIndex((i) => (i === 0 ? images.length - 1 : i - 1));
      if (e.key === "ArrowRight")
        setLightboxIndex((i) => (i === images.length - 1 ? 0 : i + 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, images.length]);

  if (!images || images.length === 0) return null;

  return (
    <>
      <div className={styles.carousel}>
        {images.length > 1 && (
          <button
            className={`${styles.arrow} ${styles.left}`}
            onClick={prev}
            aria-label="Forrige bilde"
          >
            &#8592;
          </button>
        )}
        <div
          className={styles.imageWrapper}
          onClick={openLightbox}
          title="Klikk for å se i fullskjerm"
        >
          <Image
            src={images[current]}
            alt={`${altBase} bilde ${current + 1}`}
            width={900}
            height={360}
            unoptimized
            className={styles.heroImage}
          />
          {images.length > 1 && (
            <div className={styles.counter}>
              {current + 1} / {images.length}
            </div>
          )}
          <div className={styles.expandHint}>&#x26F6;</div>
        </div>
        {images.length > 1 && (
          <button
            className={`${styles.arrow} ${styles.right}`}
            onClick={next}
            aria-label="Neste bilde"
          >
            &#8594;
          </button>
        )}
      </div>

      {lightboxOpen && (
        <div
          className={styles.lightboxOverlay}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className={styles.lightboxClose}
            onClick={() => setLightboxOpen(false)}
            aria-label="Lukk"
          >
            &#x2715;
          </button>
          <div
            className={styles.lightboxContent}
            onClick={(e) => e.stopPropagation()}
          >
            {images.length > 1 && (
              <button
                className={styles.lightboxArrow}
                onClick={() =>
                  setLightboxIndex((i) =>
                    i === 0 ? images.length - 1 : i - 1
                  )
                }
                aria-label="Forrige bilde"
              >
                &#8592;
              </button>
            )}
            <Image
              src={images[lightboxIndex]}
              alt={`${altBase} bilde ${lightboxIndex + 1}`}
              className={styles.lightboxImage}
              unoptimized
              width={1920}
              height={1080}
              style={{ width: "auto", height: "auto" }}
            />
            {images.length > 1 && (
              <button
                className={styles.lightboxArrow}
                onClick={() =>
                  setLightboxIndex((i) =>
                    i === images.length - 1 ? 0 : i + 1
                  )
                }
                aria-label="Neste bilde"
              >
                &#8594;
              </button>
            )}
          </div>
          {images.length > 1 && (
            <div className={styles.lightboxCounter}>
              {lightboxIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
