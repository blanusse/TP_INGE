import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();
  const role = session?.user?.role;
  const nombre = session?.user?.name;

  // ── Vista para usuario ya logueado ─────────────────────────────────────────
  if (session && role) {
    const esCamionero = role === "camionero" || role === "flota";
    const dashboardUrl = esCamionero ? "/camionero" : "/dador";

    const config = esCamionero
      ? {
          saludo: "Tu próximo viaje, cargado.",
          descripcion: "Encontrá cargas que se adaptan a tu ruta de vuelta. Ofertá en segundos.",
          cta: "Ver cargas disponibles →",
          stats: [
            { value: "24", label: "Cargas nuevas hoy" },
            { value: "3", label: "Ofertas activas" },
            { value: "$285.000", label: "Mejor precio disponible" },
          ],
          badge: "🚛 Panel de camionero",
          badgeBg: "var(--color-brand-light)",
          badgeColor: "var(--color-brand-dark)",
        }
      : {
          saludo: "Gestioná tus envíos en un solo lugar.",
          descripcion: "Publicá cargas, recibí ofertas de camioneros verificados y coordiná cada viaje.",
          cta: "Ver mis cargas →",
          stats: [
            { value: "11", label: "Ofertas recibidas" },
            { value: "4", label: "Cargas activas" },
            { value: "2", label: "Envíos en tránsito" },
          ],
          badge: "📦 Panel de dador de carga",
          badgeBg: "#e6f1fb",
          badgeColor: "#185fa5",
        };

    return (
      <div style={{ background: "var(--color-background-primary)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Navbar logueado */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 32px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-primary)" }}>
            Carga<span style={{ color: "var(--color-brand)" }}>Back</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              Hola, {nombre?.split(" ")[0] ?? "bienvenido"}
            </span>
            <Link
              href={dashboardUrl}
              style={{
                fontSize: 13, padding: "6px 16px",
                borderRadius: "var(--border-radius-md)",
                background: "var(--color-brand)", color: "#fff",
                fontWeight: 500, textDecoration: "none",
              }}
            >
              Ir a mi panel
            </Link>
          </div>
        </header>

        {/* Hero personalizado */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "60px 24px" }}>
          <span style={{
            fontSize: 12, fontWeight: 500,
            color: config.badgeColor,
            background: config.badgeBg,
            padding: "4px 14px", borderRadius: 20,
            marginBottom: 24, display: "inline-block",
          }}>
            {config.badge}
          </span>

          <h1 style={{ fontSize: 42, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.2, maxWidth: 560, marginBottom: 16 }}>
            {config.saludo}
          </h1>
          <p style={{ fontSize: 17, color: "var(--color-text-secondary)", maxWidth: 440, lineHeight: 1.6, marginBottom: 36 }}>
            {config.descripcion}
          </p>

          <Link
            href={dashboardUrl}
            style={{
              fontSize: 15, padding: "11px 28px",
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-brand)", color: "#fff",
              fontWeight: 600, textDecoration: "none",
            }}
          >
            {config.cta}
          </Link>

          {/* Stats del usuario */}
          <div style={{
            display: "flex", gap: 40, marginTop: 56,
            borderTop: "0.5px solid var(--color-border-tertiary)",
            paddingTop: 32, flexWrap: "wrap", justifyContent: "center",
          }}>
            {config.stats.map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 600, color: "var(--color-text-primary)" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </main>

        <footer style={{ borderTop: "0.5px solid var(--color-border-tertiary)", padding: "14px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
            Carga<span style={{ color: "var(--color-brand)" }}>Back</span> © 2026
          </span>
          <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Argentina · Chile · Perú · Bolivia</span>
        </footer>
      </div>
    );
  }

  // ── Vista pública (no logueado) ─────────────────────────────────────────────
  return (
    <div style={{ background: "var(--color-background-primary)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Navbar público */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 32px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-primary)" }}>
          Carga<span style={{ color: "var(--color-brand)" }}>Back</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Link href="/login" style={{ fontSize: 13, padding: "6px 14px", borderRadius: "var(--border-radius-md)", color: "var(--color-text-secondary)", textDecoration: "none" }}>
            Iniciar sesión
          </Link>
          <Link href="/login" style={{ fontSize: 13, padding: "6px 14px", borderRadius: "var(--border-radius-md)", background: "var(--color-brand)", color: "#fff", fontWeight: 500, textDecoration: "none" }}>
            Registrarse
          </Link>
        </nav>
      </header>

      {/* Hero público */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-brand)", background: "var(--color-brand-light)", padding: "4px 12px", borderRadius: 20, marginBottom: 24, display: "inline-block" }}>
          Bolsa de Cargas Digital
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.15, maxWidth: 640, marginBottom: 20 }}>
          El viaje de vuelta también puede generar plata
        </h1>
        <p style={{ fontSize: 17, color: "var(--color-text-secondary)", maxWidth: 480, lineHeight: 1.6, marginBottom: 40 }}>
          Conectamos camioneros con dadores de carga en Argentina y toda Latinoamérica. Sin intermediarios. Sin viajes vacíos.
        </p>

        {/* CTAs diferenciados por tipo de usuario */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/login" style={{ fontSize: 14, padding: "10px 24px", borderRadius: "var(--border-radius-md)", background: "var(--color-brand)", color: "#fff", fontWeight: 500, textDecoration: "none" }}>
            Buscar cargas →
          </Link>
          <Link href="/login" style={{ fontSize: 14, padding: "10px 24px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-primary)", fontWeight: 500, textDecoration: "none", background: "var(--color-background-primary)" }}>
            Publicar una carga
          </Link>
        </div>

        {/* Propuestas de valor por perfil */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 56, maxWidth: 680, width: "100%" }}>
          {[
            {
              icono: "🚛", titulo: "Para camioneros",
              items: ["Encontrá cargas en tu ruta de vuelta", "Ofertá tu precio en segundos", "Cobrá seguro con reputación verificada"],
              bg: "var(--color-brand-light)", color: "var(--color-brand-dark)",
            },
            {
              icono: "📦", titulo: "Para dadores de carga",
              items: ["Publicá tu carga en menos de 2 minutos", "Recibí ofertas de camioneros verificados", "Seguí cada envío en tiempo real"],
              bg: "#e6f1fb", color: "#185fa5",
            },
          ].map((card) => (
            <div key={card.titulo} style={{ background: card.bg, borderRadius: "var(--border-radius-lg)", padding: "20px 24px", textAlign: "left" }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{card.icono}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: card.color, marginBottom: 12 }}>{card.titulo}</div>
              {card.items.map((item) => (
                <div key={item} style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6, display: "flex", gap: 8 }}>
                  <span style={{ color: card.color }}>✓</span> {item}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 48, marginTop: 48, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 32, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { value: "3.400+", label: "Camioneros registrados" },
            { value: "1.200+", label: "Cargas este mes" },
            { value: "94%", label: "Viajes con retorno cargado" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: "var(--color-text-primary)" }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ borderTop: "0.5px solid var(--color-border-tertiary)", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
          Carga<span style={{ color: "var(--color-brand)" }}>Back</span> © 2026
        </span>
        <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Argentina · Chile · Perú · Bolivia</span>
      </footer>
    </div>
  );
}
