import React, { useState } from "react";
import Image from "next/image";
import styles from "./TripImageCarousel.module.css";

export default function TripImageCarousel({ images, altBase }) {
  const [current, setCurrent] = useState(0);
  if (!images || images.length === 0) return null;

  const prev = () => setCurrent((c) => (c === 0 ? images.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === images.length - 1 ? 0 : c + 1));

  return (
    <div className={styles.carousel}>
      <button
        className={styles.arrow + " " + styles.left}
        onClick={prev}
        aria-label="Forrige bilde"
      >
        &#8592;
      </button>
      <div className={styles.imageWrapper}>
        <Image
          src={images[current]}
          alt={altBase + " bilde " + (current + 1)}
          width={700}
          height={350}
          unoptimized
          className={styles.heroImage}
          style={{ maxWidth: "100%", borderRadius: 8 }}
        />
        <div className={styles.counter}>
          {current + 1} / {images.length}
        </div>
      </div>
      <button
        className={styles.arrow + " " + styles.right}
        onClick={next}
        aria-label="Neste bilde"
      >
        &#8594;
      </button>
    </div>
  );
}
