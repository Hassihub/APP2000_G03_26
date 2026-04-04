"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "../components/LanguageProvider"
import SosialFeed from "../components/SosialFeed"

export default function SosialPage() {
  const router = useRouter()
  const t = useTranslations("socialPage")
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me", { method: "GET", credentials: "include" })
        if (res.status === 401) { router.push("/login"); return }
        const data = await res.json()
        if (!cancelled) setCurrentUser(data.user)
      } catch { /* ignore */ }
    }
    loadUser()
    return () => { cancelled = true }
  }, [router])

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0f1117 0%,#1a2035 100%)", padding: "2.5rem 1rem 6rem", fontFamily: "Poppins, sans-serif" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1 style={{ color: "#f9fafb", fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.25rem" }}>{t.title}</h1>
        <p style={{ color: "#6b7280", marginBottom: "2rem", fontSize: "0.9rem" }}>Del turer, tips og naturopplevelser med andre friluftsentusiaster.</p>
        <SosialFeed currentUser={currentUser} />
      </div>
    </div>
  )
}


