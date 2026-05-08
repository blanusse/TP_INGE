"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

export function NavbarLanding() {
  const [isMobile, setIsMobile] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const scrollTo = (id: string) => {
    setInfoOpen(false);
    const el = document.getElementById(id);
    if (!el) return;
    const navbarH = 64;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - navbarH, behavior: "smooth" });
  };

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)",
      borderBottom: "0.5px solid rgba(255,255,255,0.1)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: isMobile ? "12px 16px" : "14px 48px",
    }}>
      <Link href="/" style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, textDecoration: "none", color: "#fff", flexShrink: 0 }}>
        Carga<span style={{ color: "#3a806b" }}>Back</span>
      </Link>

      {isMobile ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Dropdown "+ info" */}
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setInfoOpen((o) => !o)}
              style={{ background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 13, fontWeight: 500, padding: "7px 12px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
            >
              + info <span style={{ fontSize: 10, opacity: 0.7 }}>{infoOpen ? "▲" : "▼"}</span>
            </button>
            {infoOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "rgba(10,10,10,0.97)", border: "0.5px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "6px 0", minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 100 }}>
                {[
                  { label: "Cómo funciona", id: "como-funciona" },
                  { label: "Para quién", id: "para-quien" },
                  { label: "Contacto", id: "contacto" },
                ].map(({ label, id }) => (
                  <button key={id} onClick={() => scrollTo(id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 18px", background: "none", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                    {label}
                  </button>
                ))}
                <div style={{ height: "0.5px", background: "rgba(255,255,255,0.1)", margin: "4px 0" }} />
                <Link href="/login?modo=login" style={{ display: "block", padding: "11px 18px", color: "rgba(255,255,255,0.7)", fontSize: 14, textDecoration: "none" }}>
                  Iniciar sesión
                </Link>
              </div>
            )}
          </div>

          <Link href="/login?modo=login" style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, background: "transparent", color: "#fff", textDecoration: "none", fontWeight: 500, flexShrink: 0, border: "0.5px solid rgba(255,255,255,0.35)" }}>
            Iniciar sesión
          </Link>
        </div>
      ) : (
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => scrollTo("como-funciona")} style={navBtnStyle}>Cómo funciona</button>
          <button onClick={() => scrollTo("para-quien")}    style={navBtnStyle}>Para quién</button>
          <button onClick={() => scrollTo("contacto")}      style={navBtnStyle}>Contacto</button>
          <Link href="/login?modo=login"    style={btnSecStyle}>Iniciar sesión</Link>
          <Link href="/login?modo=registro" style={btnPriStyle}>Registrarse gratis</Link>
        </nav>
      )}
    </header>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: 13, color: "rgba(255,255,255,0.7)",
  padding: "6px 12px", borderRadius: 6,
};

const btnSecStyle: React.CSSProperties = {
  fontSize: 13, padding: "7px 16px",
  borderRadius: "var(--border-radius-md)",
  border: "0.5px solid rgba(255,255,255,0.2)",
  color: "#fff", textDecoration: "none", fontWeight: 500,
};

const btnPriStyle: React.CSSProperties = {
  fontSize: 13, padding: "7px 16px",
  borderRadius: "var(--border-radius-md)",
  background: "#3a806b", color: "#fff",
  textDecoration: "none", fontWeight: 600,
};
