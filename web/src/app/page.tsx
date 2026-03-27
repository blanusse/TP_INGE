import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div style={{ background: "#fff", color: "var(--color-text-primary)", fontFamily: "var(--font-sans, sans-serif)" }}>

      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 48px" }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
          Carga<span style={{ color: "var(--color-brand)" }}>Back</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="#como-funciona" style={{ fontSize: 13, color: "var(--color-text-secondary)", textDecoration: "none", padding: "6px 12px" }}>Cómo funciona</a>
          <a href="#para-quien" style={{ fontSize: 13, color: "var(--color-text-secondary)", textDecoration: "none", padding: "6px 12px" }}>Para quién</a>
          <a href="#contacto" style={{ fontSize: 13, color: "var(--color-text-secondary)", textDecoration: "none", padding: "6px 12px" }}>Contacto</a>
          <Link href="/login?modo=login" style={{ fontSize: 13, padding: "7px 16px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-primary)", textDecoration: "none", fontWeight: 500 }}>
            Iniciar sesión
          </Link>
          <Link href="/login?modo=registro" style={{ fontSize: 13, padding: "7px 16px", borderRadius: "var(--border-radius-md)", background: "var(--color-brand)", color: "#fff", textDecoration: "none", fontWeight: 600 }}>
            Registrarse gratis
          </Link>
        </nav>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{ background: "linear-gradient(160deg, #0f1a16 0%, #0f6e56 60%, #1d9e75 100%)", color: "#fff", padding: "100px 48px 120px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Decoración de fondo */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 50%, rgba(29,158,117,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(15,110,86,0.4) 0%, transparent 40%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "inline-block", fontSize: 12, fontWeight: 600, color: "#6ee7b7", background: "rgba(110,231,183,0.12)", border: "0.5px solid rgba(110,231,183,0.3)", padding: "5px 14px", borderRadius: 20, marginBottom: 28, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Bolsa de cargas digital · Argentina
          </div>

          <h1 style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.1, marginBottom: 24, letterSpacing: -1.5 }}>
            El viaje de vuelta<br />
            <span style={{ color: "#6ee7b7" }}>también genera plata</span>
          </h1>

          <p style={{ fontSize: 19, color: "rgba(255,255,255,0.75)", maxWidth: 560, margin: "0 auto 44px", lineHeight: 1.65 }}>
            Conectamos camioneros con dadores de carga en toda Argentina. Sin intermediarios, sin viajes vacíos, sin burocracia.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/login?modo=registro" style={{ fontSize: 15, padding: "13px 32px", borderRadius: "var(--border-radius-md)", background: "#fff", color: "#0f6e56", fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
              Registrarse gratis →
            </Link>
            <Link href="/login?modo=login" style={{ fontSize: 15, padding: "13px 32px", borderRadius: "var(--border-radius-md)", background: "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 600, textDecoration: "none", border: "0.5px solid rgba(255,255,255,0.25)" }}>
              Ya tengo cuenta
            </Link>
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
              <div style={{ fontSize: 32, fontWeight: 800, color: "var(--color-brand)", letterSpacing: -1 }}>{s.valor}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ────────────────────────────────────────────────────── */}
      <section id="como-funciona" style={{ padding: "96px 48px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-brand)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Proceso simple</div>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, marginBottom: 14 }}>Cómo funciona CargaBack</h2>
          <p style={{ fontSize: 16, color: "var(--color-text-secondary)", maxWidth: 500, margin: "0 auto" }}>Tres pasos para que tu camión nunca vuelva vacío.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { n: "01", titulo: "Publicá o registrá tu ruta", desc: "El camionero carga su viaje: origen, destino y fecha de salida. El dador publica su carga con todos los requisitos." },
            { n: "02", titulo: "El algoritmo hace el match", desc: "CargaBack cruza rutas, tipos de camión, certificaciones requeridas y disponibilidad para sugerir el mejor match posible." },
            { n: "03", titulo: "Coordiná y viajá", desc: "Aceptás el match, generás el remito digital desde la plataforma y coordinás el retiro. Todo en menos de 15 minutos." },
          ].map((p) => (
            <div key={p.n} style={{ padding: 28, borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-brand)", marginBottom: 16, fontVariantNumeric: "tabular-nums" }}>{p.n}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>{p.titulo}</h3>
              <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Para quién ───────────────────────────────────────────────────────── */}
      <section id="para-quien" style={{ background: "var(--color-background-secondary)", padding: "96px 48px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-brand)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Para cada perfil</div>
            <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>Diseñado para vos</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
            {[
              {
                icono: "🚛", titulo: "Camionero independiente",
                color: "var(--color-brand-dark)", bg: "var(--color-brand-light)",
                items: ["Encontrá cargas para tu vuelta en segundos", "Ofertá tu precio directamente", "Historial de viajes y reputación verificada", "Certificaciones y documentación digital"],
              },
              {
                icono: "🏢", titulo: "Empresa de flota",
                color: "#185fa5", bg: "#e6f1fb",
                items: ["Gestioná múltiples camiones y conductores", "Visión centralizada de toda la operación", "Asignación automática de cargas por ruta", "Reportes y métricas de rendimiento"],
              },
              {
                icono: "📦", titulo: "Dador de carga",
                color: "#7c3aed", bg: "#f3f0ff",
                items: ["Publicá cargas en menos de 2 minutos", "Recibí ofertas de camioneros verificados", "Remitos digitales y seguimiento en tiempo real", "Sin comisiones ocultas ni intermediarios"],
              },
            ].map((card) => (
              <div key={card.titulo} style={{ background: "#fff", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
                <div style={{ background: card.bg, padding: "24px 28px 20px" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{card.icono}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: card.color }}>{card.titulo}</div>
                </div>
                <div style={{ padding: "20px 28px 28px" }}>
                  {card.items.map((item) => (
                    <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                      <span style={{ color: card.color, marginTop: 1, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                  <Link href="/login?modo=registro" style={{ display: "block", marginTop: 20, textAlign: "center", padding: "9px", borderRadius: "var(--border-radius-md)", background: card.bg, color: card.color, fontSize: 13, fontWeight: 600, textDecoration: "none", border: `0.5px solid ${card.color}22` }}>
                    Registrarme como {card.titulo.split(" ")[0].toLowerCase()} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Por qué CargaBack ─────────────────────────────────────────────────── */}
      <section style={{ padding: "96px 48px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-brand)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Nuestras ventajas</div>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>Por qué elegir CargaBack</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            { icono: "⚡", titulo: "Match en minutos", desc: "Nuestro algoritmo cruza rutas y requisitos en tiempo real. En promedio, un camionero encuentra carga en 12 minutos." },
            { icono: "🔒", titulo: "Seguridad y verificación", desc: "Cada usuario pasa por verificación de identidad, habilitaciones y antecedentes antes de operar en la plataforma." },
            { icono: "📄", titulo: "Documentación digital", desc: "Remitos, carta de porte y certificaciones se generan y almacenan digitalmente. Sin papel, sin pérdidas." },
            { icono: "📍", titulo: "Seguimiento en tiempo real", desc: "Dadores y camioneros pueden seguir cada envío en el mapa. Notificaciones automáticas en cada etapa." },
            { icono: "💬", titulo: "Reputación transparente", desc: "Sistema de reviews bidireccional. Sabés con quién trabajás antes de aceptar cualquier viaje." },
            { icono: "🇦🇷", titulo: "Hecho para Argentina", desc: "Entendemos la logística local: rutas, SIAC, habilitaciones provinciales, legislación vigente." },
          ].map((f) => (
            <div key={f.titulo} style={{ padding: "24px", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icono}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.titulo}</div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonios ──────────────────────────────────────────────────────── */}
      <section style={{ background: "var(--color-background-secondary)", padding: "80px 48px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, textAlign: "center", marginBottom: 48, letterSpacing: -0.5 }}>Lo que dicen nuestros usuarios</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {[
              { nombre: "Carlos M.", rol: "Camionero · Rosario", texto: "Antes volvía vacío de Buenos Aires siempre. Ahora en 20 minutos encuentro carga para el regreso. Cambió todo." },
              { nombre: "Laura P.", rol: "Dadora de carga · CABA", texto: "Tardaba días en conseguir un camionero confiable. Con CargaBack tengo ofertas en horas y puedo ver el historial de cada uno." },
              { nombre: "Transportes Del Sur", rol: "Empresa de flota · Mendoza", texto: "Gestionamos 18 camiones desde una sola pantalla. Las rutas de retorno están siempre cubiertas. La eficiencia subió un 40%." },
            ].map((t) => (
              <div key={t.nombre} style={{ background: "#fff", borderRadius: "var(--border-radius-lg)", padding: 24, border: "0.5px solid var(--color-border-tertiary)" }}>
                <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.65, marginBottom: 20, fontStyle: "italic" }}>"{t.texto}"</p>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{t.nombre}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2 }}>{t.rol}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────────────── */}
      <section style={{ background: "linear-gradient(135deg, #0f1a16, #0f6e56)", padding: "96px 48px", textAlign: "center", color: "#fff" }}>
        <h2 style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1, marginBottom: 16 }}>Empezá hoy. Es gratis.</h2>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", maxWidth: 480, margin: "0 auto 40px", lineHeight: 1.6 }}>
          Miles de camioneros y dadores de carga ya están operando en CargaBack. Unite a la red logística más grande de Argentina.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/login?modo=registro" style={{ fontSize: 15, padding: "13px 32px", borderRadius: "var(--border-radius-md)", background: "#fff", color: "#0f6e56", fontWeight: 700, textDecoration: "none" }}>
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
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-brand)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Estamos para ayudarte</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>Contacto</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { icono: "✉️", titulo: "Email", linea1: "hola@cargaback.com.ar", linea2: "Respondemos en menos de 24hs" },
            { icono: "📞", titulo: "Teléfono", linea1: "+54 11 5555-0100", linea2: "Lunes a viernes 8 a 18hs" },
            { icono: "📍", titulo: "Oficina", linea1: "Av. del Libertador 5450, CABA", linea2: "Buenos Aires, Argentina" },
          ].map((c) => (
            <div key={c.titulo} style={{ padding: 28, borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{c.icono}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{c.titulo}</div>
              <div style={{ fontSize: 14, color: "var(--color-text-primary)", fontWeight: 500 }}>{c.linea1}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 4 }}>{c.linea2}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{ background: "var(--color-background-secondary)", borderTop: "0.5px solid var(--color-border-tertiary)", padding: "40px 48px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 32, marginBottom: 40 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Carga<span style={{ color: "var(--color-brand)" }}>Back</span></div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6, maxWidth: 280 }}>
                La plataforma de logística que conecta camioneros y dadores de carga en Argentina y Latinoamérica.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14, color: "var(--color-text-tertiary)" }}>Producto</div>
              {["Cómo funciona", "Para camioneros", "Para empresas", "Para dadores"].map((l) => (
                <div key={l} style={{ marginBottom: 8 }}><a href="#" style={{ fontSize: 13, color: "var(--color-text-secondary)", textDecoration: "none" }}>{l}</a></div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14, color: "var(--color-text-tertiary)" }}>Legal</div>
              {["Términos y condiciones", "Política de privacidad", "Cookies"].map((l) => (
                <div key={l} style={{ marginBottom: 8 }}><a href="#" style={{ fontSize: 13, color: "var(--color-text-secondary)", textDecoration: "none" }}>{l}</a></div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14, color: "var(--color-text-tertiary)" }}>Contacto</div>
              {["hola@cargaback.com.ar", "+54 11 5555-0100", "Instagram", "LinkedIn"].map((l) => (
                <div key={l} style={{ marginBottom: 8 }}><a href="#" style={{ fontSize: 13, color: "var(--color-text-secondary)", textDecoration: "none" }}>{l}</a></div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>© 2026 CargaBack. Todos los derechos reservados.</span>
            <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Argentina · Chile · Perú · Bolivia</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
