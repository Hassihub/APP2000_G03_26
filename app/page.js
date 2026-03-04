"use client";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        fontFamily: "'Inter', sans-serif",
        overflowY: "scroll",
        overflowX: "hidden",
        scrollSnapType: "y mandatory",
      }}
    >
      {/* HERO VIDEO */}
      <div style={{ position: "relative", height: "100vh" }}>
        <video
          autoPlay
          loop
          muted
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: -1,
          }}
        >
          <source src="/images/Natur.mp4" type="video/mp4" />
        </video>

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,50,20,0.35)",
          }}
        />

        <section
          style={{
            height: "100vh",
            scrollSnapAlign: "start",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h1
            style={{
              fontSize: "4rem",
              fontWeight: 700,
              marginBottom: "2rem",
              textShadow: "2px 2px 10px rgba(0,0,0,0.7)",
            }}
          >
            {t.title}
          </h1>

          <div
            style={{
              display: "flex",
              gap: "2rem",
              flexWrap: "wrap",
              justifyContent: "center",
              marginBottom: "2rem",
            }}
          >
            <Category icon={<FiSun size={42} />} label="Vær" link="/vaer" />
            <Category icon={<FiGlobe size={42} />} label="Utforsk" link="/explore" />
            <Category icon={<FiMap size={42} />} label="Kart" link="/map" />
            <Category icon={<FiUsers size={42} />} label="Sosial" link="/sosial" />
            <Category icon={<FiHome size={42} />} label="Reserver" link="/reserver" />
          </div>

          <div style={{ width: "100%", maxWidth: "600px" }}>
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                objectFit: "cover",
                objectPosition: "center",
                pointerEvents: "none",
              }}
            />
          </div>

          <button
            onClick={scrollToNext}
            style={{
              marginTop: "3rem",
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <FiChevronDown size={50} />
          </button>
        </section>
      </div>

      {/* FULLSCREEN KARUSELL */}
      <section
        id="recommended-section"
        style={{
          height: "100vh",
          scrollSnapAlign: "start",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {slides.map((slide, idx) => (
          <div
            key={idx}
            style={{
              position: idx === currentSlide ? "relative" : "absolute",
              opacity: idx === currentSlide ? 1 : 0,
              transition: "opacity 0.5s ease-in-out",
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              src={slide.img}
              alt={slide.title}
              fill
              style={{
                objectFit: "cover",
                filter: "blur(8px) brightness(0.6)",
              }}
            />

            <div
              style={{
                width: "90%",
                maxWidth: "1200px",
                display: "flex",
                gap: "2rem",
                alignItems: "center",
                color: "#fff",
                position: "relative",
                zIndex: 2,
              }}
            >
              <div style={{ flex: 1 }}>
                <h2 style={{ opacity: 0.8 }}>{slide.category}</h2>
                <Image
                  src={slide.img}
                  alt={slide.title}
                  width={600}
                  height={450}
                  style={{
                    boxShadow: "0 15px 40px rgba(0,0,0,0.5)",
                    objectFit: "cover",
                    maxWidth: "100%",
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: "3rem" }}>{slide.title}</h1>
                <p><FiMapPin /> {slide.start}</p>
                <p><FiClock /> {slide.duration}</p>
                <p><FiTrendingUp /> {slide.difficulty}</p>

                <Link
                  href={slide.link}
                  style={{
                    marginTop: "1rem",
                    padding: "1rem 2rem",
                    backgroundColor: "#2e5c44",
                    color: "#fff",
                    fontWeight: 700,
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  {t.start}
                </Link>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={prevSlide}
          style={{
            position: "absolute",
            left: "1rem",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(0,0,0,0.4)",
            border: "none",
            padding: "1rem",
            borderRadius: "50%",
            cursor: "pointer",
          }}
        >
          <FiChevronLeft size={32} color="#fff" />
        </button>

        <button
          onClick={nextSlide}
          style={{
            position: "absolute",
            right: "1rem",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(0,0,0,0.4)",
            border: "none",
            padding: "1rem",
            borderRadius: "50%",
            cursor: "pointer",
          }}
        >
          <FiChevronRight size={32} color="#fff" />
        </button>
      </section>
    </div>
  );
}
