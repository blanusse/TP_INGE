"use client";

import Link from "next/link";

export function NavbarLanding() {
  const scrollTo = (id: string) => {
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
      padding: "14px 48px",
    }}>
      <Link href="/" style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, textDecoration: "none", color: "#fff" }}>
        Carga<span style={{ color: "#3a806b" }}>Back</span>
      </Link>

      <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button onClick={() => scrollTo("como-funciona")} style={navBtnStyle}>Cómo funciona</button>
        <button onClick={() => scrollTo("para-quien")}    style={navBtnStyle}>Para quién</button>
        <button onClick={() => scrollTo("contacto")}      style={navBtnStyle}>Contacto</button>
        <Link href="/login?modo=login"    style={btnSecStyle}>Iniciar sesión</Link>
        <Link href="/login?modo=registro" style={btnPriStyle}>Registrarse gratis</Link>
      </nav>
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
