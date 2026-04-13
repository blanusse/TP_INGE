import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NavbarLanding } from "./_components/NavbarLanding";
import { ParticleHero } from "./_components/ParticleHero";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div style={{ background: "#000", color: "#fff", fontFamily: "var(--font-sans, sans-serif)" }}>

      <NavbarLanding />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{ background: "#000", color: "#fff", textAlign: "center", position: "relative", overflow: "hidden" }}>

        {/* Canvas as full-width background */}
        <div style={{ position: "relative", width: "100%" }}>
          <ParticleHero />

          {/* Overlay content centered on top of canvas */}
          {/* Badge — top */}
          <div style={{ position: "absolute", top: 32, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
            <div style={{ display: "inline-block", fontSize: 12, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.12)", border: "0.5px solid rgba(255,255,255,0.3)", padding: "5px 14px", borderRadius: 20, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Bolsa de cargas digital · Argentina
            </div>
          </div>

          {/* Text + buttons — bottom */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "0 48px 60px" }}>
            <p style={{ fontSize: 19, color: "rgba(255,255,255,0.75)", maxWidth: 560, margin: "0 auto 44px", lineHeight: 1.65 }}>
              Conectamos camioneros con dadores de carga en toda Argentina. Sin intermediarios, sin viajes vacíos, sin burocracia.
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/login?modo=registro" style={{ fontSize: 15, padding: "13px 32px", borderRadius: "var(--border-radius-md)", background: "#000", color: "#fff", fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: "0.5px solid rgba(255,255,255,0.3)" }}>
                Registrarse gratis →
              </Link>
              <Link href="/login?modo=login" style={{ fontSize: 15, padding: "13px 32px", borderRadius: "var(--border-radius-md)", background: "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 600, textDecoration: "none", border: "0.5px solid rgba(255,255,255,0.25)" }}>
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <section style={{ background: "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "36px 48px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, textAlign: "center" }}>
          {[
            { valor: "3.400+",  label: "Camioneros registrados" },
            { valor: "1.200+",  label: "Cargas por mes" },
            { valor: "94%",     label: "Viajes con retorno cargado" },
            { valor: "12 min",  label: "Tiempo promedio de match" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#3a806b", letterSpacing: -1 }}>{s.valor}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ────────────────────────────────────────────────────── */}
      <section id="como-funciona" style={{ padding: "96px 48px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#3a806b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Proceso simple</div>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, marginBottom: 14 }}>Cómo funciona CargaBack</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", maxWidth: 500, margin: "0 auto" }}>Tres pasos para que tu camión nunca vuelva vacío.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { n: "01", titulo: "Publicá o registrá tu ruta", desc: "El camionero carga su viaje: origen, destino y fecha de salida. El dador publica su carga con todos los requisitos." },
            { n: "02", titulo: "El algoritmo hace el match", desc: "CargaBack cruza rutas, tipos de camión, certificaciones requeridas y disponibilidad para sugerir el mejor match posible." },
            { n: "03", titulo: "Coordiná y viajá", desc: "Aceptás el match, generás el remito digital desde la plataforma y coordinás el retiro. Todo en menos de 15 minutos." },
          ].map((p) => (
            <div key={p.n} style={{ padding: 28, borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#3a806b", marginBottom: 16, fontVariantNumeric: "tabular-nums" }}>{p.n}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, lineHeight: 1.3, color: "#000" }}>{p.titulo}</h3>
              <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Para quién ───────────────────────────────────────────────────────── */}
      <section id="para-quien" style={{ background: "var(--color-background-secondary)", padding: "96px 48px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#3a806b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Para cada perfil</div>
            <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, color: "#000" }}>Diseñado para vos</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
            {[
              {
                icono: (<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>),
                titulo: "Camionero independiente",
                color: "#3a806b", bg: "rgba(58,128,107,0.15)",
                perfil: "camionero", paginaInfo: "/para/camioneros",
                items: ["Encontrá cargas para tu vuelta en segundos", "Ofertá tu precio directamente", "Historial de viajes y reputación verificada", "Certificaciones y documentación digital"],
              },
              {
                icono: (<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#185fa5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {/* Camión grande arriba */}
                  <rect x="1" y="2" width="10" height="8" rx="0.8"/>
                  <path d="M11 4.5h2.5l2 3.5v2H11V4.5z"/>
                  <circle cx="3.5" cy="12" r="1.5"/>
                  <circle cx="12" cy="12" r="1.5"/>
                  {/* Camión chico abajo izquierda */}
                  <rect x="1" y="15" width="7" height="5" rx="0.6"/>
                  <path d="M8 16.5h1.5l1.5 2.5v1H8v-3.5z"/>
                  <circle cx="2.8" cy="21.5" r="1.2"/>
                  <circle cx="8.5" cy="21.5" r="1.2"/>
                  {/* Camión chico abajo derecha */}
                  <rect x="13" y="15" width="7" height="5" rx="0.6"/>
                  <path d="M20 16.5h1.5l1.5 2.5v1H20v-3.5z"/>
                  <circle cx="14.8" cy="21.5" r="1.2"/>
                  <circle cx="20.5" cy="21.5" r="1.2"/>
                </svg>),
                titulo: "Empresa de flota",
                color: "#185fa5", bg: "#000",
                perfil: "flota", paginaInfo: "/para/empresas",
                items: ["Gestioná múltiples camiones y conductores", "Visión centralizada de toda la operación", "Asignación automática de cargas por ruta", "Reportes y métricas de rendimiento"],
              },
              {
                icono: (<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><line x1="12" y1="22" x2="12" y2="12"/></svg>),
                titulo: "Dador de carga",
                color: "#7c3aed", bg: "#000",
                perfil: "dador", paginaInfo: "/para/dadores",
                items: ["Publicá cargas en menos de 2 minutos", "Recibí ofertas de camioneros verificados", "Remitos digitales y seguimiento en tiempo real", "Sin comisiones ocultas ni intermediarios"],
              },
            ].map((card) => (
              <div key={card.titulo} style={{ background: "#000", borderRadius: "var(--border-radius-lg)", border: "0.5px solid rgba(255,255,255,0.15)", overflow: "hidden" }}>
                <div style={{ background: card.bg, padding: "24px 28px 20px" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{card.icono}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: card.color }}>{card.titulo}</div>
                </div>
                <div style={{ padding: "20px 28px 28px" }}>
                  {card.items.map((item) => (
                    <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                      <span style={{ color: card.color, marginTop: 2, flexShrink: 0, display: "flex" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                    <Link href={`/login?modo=registro&perfil=${card.perfil}`} style={{ flex: 1, display: "block", textAlign: "center", padding: "9px", borderRadius: "var(--border-radius-md)", background: card.bg, color: card.color, fontSize: 13, fontWeight: 600, textDecoration: "none", border: `0.5px solid ${card.color}33` }}>
                      Registrarme →
                    </Link>
                    <Link href={card.paginaInfo} style={{ display: "block", textAlign: "center", padding: "9px 12px", borderRadius: "var(--border-radius-md)", background: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, textDecoration: "none", border: "0.5px solid rgba(255,255,255,0.2)" }}>
                      Más info
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Por qué CargaBack ─────────────────────────────────────────────────── */}
      <section style={{ padding: "96px 48px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#3a806b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Nuestras ventajas</div>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>Por qué elegir CargaBack</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            { icono: (<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>), titulo: "Match en minutos", desc: "Nuestro algoritmo cruza rutas y requisitos en tiempo real. En promedio, un camionero encuentra carga en 12 minutos." },
            { icono: (<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>), titulo: "Seguridad y verificación", desc: "Cada usuario pasa por verificación de identidad, habilitaciones y antecedentes antes de operar en la plataforma." },
            { icono: (<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>), titulo: "Documentación digital", desc: "Remitos, carta de porte y certificaciones se generan y almacenan digitalmente. Sin papel, sin pérdidas." },
            { icono: (<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>), titulo: "Seguimiento en tiempo real", desc: "Dadores y camioneros pueden seguir cada envío en el mapa. Notificaciones automáticas en cada etapa." },
            { icono: (<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>), titulo: "Reputación transparente", desc: "Sistema de reviews bidireccional. Sabés con quién trabajás antes de aceptar cualquier viaje." },
            { icono: (<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>), titulo: "Hecho para Argentina", desc: "Entendemos la logística local: rutas, SIAC, habilitaciones provinciales, legislación vigente." },
          ].map((f) => (
            <div key={f.titulo} style={{ padding: "24px", borderRadius: "var(--border-radius-lg)", border: "0.5px solid rgba(255,255,255,0.15)" }}>
              <div style={{ marginBottom: 12 }}>{f.icono}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.titulo}</div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonios ──────────────────────────────────────────────────────── */}
      <section style={{ background: "var(--color-background-secondary)", padding: "80px 48px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, textAlign: "center", marginBottom: 48, letterSpacing: -0.5, color: "#000" }}>Lo que dicen nuestros usuarios</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {[
              { nombre: "Carlos M.", rol: "Camionero · Rosario", texto: "Antes volvía vacío de Buenos Aires siempre. Ahora en 20 minutos encuentro carga para el regreso. Cambió todo." },
              { nombre: "Laura P.", rol: "Dadora de carga · CABA", texto: "Tardaba días en conseguir un camionero confiable. Con CargaBack tengo ofertas en horas y puedo ver el historial de cada uno." },
              { nombre: "Transportes Del Sur", rol: "Empresa de flota · Mendoza", texto: "Gestionamos 18 camiones desde una sola pantalla. Las rutas de retorno están siempre cubiertas. La eficiencia subió un 40%." },
            ].map((t) => (
              <div key={t.nombre} style={{ background: "#000", borderRadius: "var(--border-radius-lg)", padding: 24, border: "0.5px solid rgba(255,255,255,0.15)" }}>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.65, marginBottom: 20, fontStyle: "italic" }}>"{t.texto}"</p>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{t.nombre}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{t.rol}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────────────── */}
      <section style={{ background: "linear-gradient(135deg, #162e27, #3a806b)", padding: "96px 48px", textAlign: "center", color: "#fff" }}>
        <h2 style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1, marginBottom: 16 }}>Empezá hoy. Es gratis.</h2>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", maxWidth: 480, margin: "0 auto 40px", lineHeight: 1.6 }}>
          Miles de camioneros y dadores de carga ya están operando en CargaBack. Unite a la red logística más grande de Argentina.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/login?modo=registro" style={{ fontSize: 15, padding: "13px 32px", borderRadius: "var(--border-radius-md)", background: "#000", color: "#fff", fontWeight: 700, textDecoration: "none", border: "0.5px solid rgba(255,255,255,0.3)" }}>
            Registrarse gratis →
          </Link>
          <Link href="/login?modo=login" style={{ fontSize: 15, padding: "13px 32px", borderRadius: "var(--border-radius-md)", background: "transparent", color: "#fff", fontWeight: 600, textDecoration: "none", border: "0.5px solid rgba(255,255,255,0.3)" }}>
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      {/* ── Contacto ─────────────────────────────────────────────────────────── */}
      <section id="contacto" style={{ padding: "80px 48px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#3a806b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Estamos para ayudarte</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>Contacto</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { icono: (<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>), titulo: "Email", linea1: "hola@cargaback.com.ar", linea2: "Respondemos en menos de 24hs" },
            { icono: (<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.41 2 2 0 0 1 3.62 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.18 6.18l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>), titulo: "Teléfono", linea1: "+54 11 5555-0100", linea2: "Lunes a viernes 8 a 18hs" },
            { icono: (<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>), titulo: "Oficina", linea1: "Av. del Libertador 5450, CABA", linea2: "Buenos Aires, Argentina" },
          ].map((c) => (
            <div key={c.titulo} style={{ padding: 28, borderRadius: "var(--border-radius-lg)", border: "0.5px solid rgba(255,255,255,0.15)", textAlign: "center" }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>{c.icono}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{c.titulo}</div>
              <div style={{ fontSize: 14, color: "#fff", fontWeight: 500 }}>{c.linea1}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{c.linea2}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{ background: "linear-gradient(135deg, #162e27, #3a806b)", borderTop: "none", padding: "40px 48px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 32, marginBottom: 40 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#fff" }}>Carga<span style={{ color: "rgba(255,255,255,0.6)" }}>Back</span></div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, maxWidth: 280 }}>
                La plataforma de logística que conecta camioneros y dadores de carga en Argentina y Latinoamérica.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14, color: "rgba(255,255,255,0.5)" }}>Producto</div>
              {[
                { label: "Cómo funciona",  href: "/#como-funciona" },
                { label: "Para camioneros", href: "/para/camioneros" },
                { label: "Para empresas",   href: "/para/empresas" },
                { label: "Para dadores",    href: "/para/dadores" },
              ].map((l) => (
                <div key={l.label} style={{ marginBottom: 8 }}><Link href={l.href} style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", textDecoration: "none" }}>{l.label}</Link></div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14, color: "rgba(255,255,255,0.5)" }}>Legal</div>
              {["Términos y condiciones", "Política de privacidad", "Cookies"].map((l) => (
                <div key={l} style={{ marginBottom: 8 }}><a href="#" style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", textDecoration: "none" }}>{l}</a></div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14, color: "rgba(255,255,255,0.5)" }}>Contacto</div>
              {["hola@cargaback.com.ar", "+54 11 5555-0100", "Instagram", "LinkedIn"].map((l) => (
                <div key={l} style={{ marginBottom: 8 }}><a href="#" style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", textDecoration: "none" }}>{l}</a></div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.2)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>© 2026 CargaBack. Todos los derechos reservados.</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Argentina · Chile · Perú · Bolivia</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
