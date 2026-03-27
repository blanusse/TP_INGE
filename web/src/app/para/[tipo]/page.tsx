import { notFound } from "next/navigation";
import Link from "next/link";

const CONTENIDO = {
  camioneros: {
    perfil: "camionero",
    icono: "🚛",
    titulo: "CargaBack para camioneros",
    subtitulo: "Terminó la era de los viajes vacíos. Encontrá carga para tu vuelta en minutos.",
    color: "var(--color-brand-dark)",
    bg: "linear-gradient(135deg, #0f1a16 0%, #0f6e56 100%)",
    secciones: [
      {
        titulo: "¿Por qué los camioneros eligen CargaBack?",
        items: [
          { icono: "⚡", titulo: "Match en minutos", desc: "Publicás tu ruta y en menos de 15 minutos el algoritmo te muestra las cargas disponibles que coinciden con tu destino, tipo de camión y disponibilidad." },
          { icono: "💰", titulo: "Vos ponés el precio", desc: "No hay tarifas fijas ni intermediarios. Ofertás directamente con el dador de carga y negociás en tiempo real." },
          { icono: "📄", titulo: "Remito digital", desc: "Generá la carta de porte y el remito desde la app antes de cargar. Sin papel, sin errores, sin demoras en la balanza." },
          { icono: "⭐", titulo: "Reputación que vale plata", desc: "Cada viaje bien hecho suma puntos a tu perfil. Los dadores prefieren camioneros con historial verificado y pagan más." },
          { icono: "🔒", titulo: "Cobro seguro", desc: "El sistema retiene el pago del dador antes del viaje. Cuando entregás, liberamos el dinero. Sin riesgo de no cobrar." },
          { icono: "📍", titulo: "Seguimiento en tiempo real", desc: "El dador sigue tu posición en el mapa. Menos llamados, menos interrupciones, más foco en la ruta." },
        ],
      },
      {
        titulo: "Cómo funciona para vos",
        pasos: [
          { n: "01", titulo: "Registrá tu camión", desc: "Completá los datos de tu vehículo, VTV, seguro y tu licencia. La verificación tarda menos de 24 horas." },
          { n: "02", titulo: "Publicá tu viaje", desc: "Ingresá origen, destino, fecha y capacidad disponible. En segundos el sistema cruza tu ruta con las cargas disponibles." },
          { n: "03", titulo: "Elegí la mejor oferta", desc: "Ves todas las cargas que encajan con tu viaje. Comparás precios, distancias y requisitos. Aceptás con un tap." },
          { n: "04", titulo: "Viajá y cobrá", desc: "Entregás la carga, firmás el remito digital y el pago se acredita en tu cuenta en 24 hs hábiles." },
        ],
      },
      {
        titulo: "Gestión de certificaciones",
        desc: "CargaBack te avisa cuando tu VTV, seguro o licencia están por vencer. Subís los documentos renovados desde la app y en 24hs están verificados. Nunca más perdiste una carga por documentación vencida.",
      },
    ],
    cta: "Quiero registrarme como camionero",
  },
  empresas: {
    perfil: "flota",
    icono: "🏢",
    titulo: "CargaBack para empresas de transporte",
    subtitulo: "Gestioná toda tu flota desde un solo panel. Más eficiencia, menos kilómetros vacíos.",
    color: "#185fa5",
    bg: "linear-gradient(135deg, #0c1a2e 0%, #185fa5 100%)",
    secciones: [
      {
        titulo: "¿Por qué las empresas eligen CargaBack?",
        items: [
          { icono: "🗂️", titulo: "Panel centralizado", desc: "Todos tus camiones, conductores y viajes en una sola pantalla. Asignación de cargas, seguimiento en tiempo real y reportes automáticos." },
          { icono: "🤖", titulo: "Asignación inteligente", desc: "El sistema sugiere qué conductor asignar a cada carga según disponibilidad, habilitaciones y cercanía. Reducís tiempos muertos." },
          { icono: "📊", titulo: "Métricas y reportes", desc: "KPIs de flota, eficiencia de rutas, kilómetros vacíos por mes, ingresos por unidad. Todo exportable a PDF y Excel." },
          { icono: "👷", titulo: "Gestión de conductores", desc: "Alta de choferes, control de licencias, historial de viajes y calificaciones. Sabés quién está disponible en cada momento." },
          { icono: "📄", titulo: "Documentación digital", desc: "Cartas de porte, remitos y comprobantes generados automáticamente para cada viaje. Auditoría completa con un click." },
          { icono: "🔗", titulo: "API para integración", desc: "¿Ya tenés un TMS? CargaBack se integra con los principales sistemas de gestión de transporte del mercado." },
        ],
      },
      {
        titulo: "Cómo funciona para tu empresa",
        pasos: [
          { n: "01", titulo: "Registrá tu empresa", desc: "Completá los datos de la empresa, CUIT y razón social. Luego sumás camiones y conductores desde el panel." },
          { n: "02", titulo: "Cargá tu flota", desc: "Ingresá cada unidad con su documentación. El sistema alerta vencimientos y gestiona la renovación." },
          { n: "03", titulo: "Publicá rutas y recibí cargas", desc: "Configurás las rutas habituales de tu flota y el sistema matchea automáticamente con las cargas disponibles." },
          { n: "04", titulo: "Operá y medí", desc: "Seguí cada viaje en tiempo real. Al cierre del mes, tenés todos los reportes generados automáticamente." },
        ],
      },
    ],
    cta: "Quiero registrar mi empresa",
  },
  dadores: {
    perfil: "dador",
    icono: "📦",
    titulo: "CargaBack para dadores de carga",
    subtitulo: "Publicá tu carga, recibí ofertas verificadas y seguí cada envío en tiempo real.",
    color: "#7c3aed",
    bg: "linear-gradient(135deg, #1a0a2e 0%, #7c3aed 100%)",
    secciones: [
      {
        titulo: "¿Por qué los dadores eligen CargaBack?",
        items: [
          { icono: "⚡", titulo: "Publicación en 2 minutos", desc: "Completás origen, destino, tipo de carga y requisitos especiales. En minutos empezás a recibir ofertas de camioneros verificados." },
          { icono: "✅", titulo: "Camioneros verificados", desc: "Cada transportista pasó por verificación de identidad, habilitaciones y antecedentes. Ves el historial completo antes de aceptar." },
          { icono: "📍", titulo: "Seguimiento en tiempo real", desc: "Seguís la posición del camión en el mapa desde que retira hasta que entrega. Recibís notificaciones automáticas en cada etapa." },
          { icono: "📄", titulo: "Documentación automática", desc: "La carta de porte, el remito y el comprobante de entrega se generan solos. Sin papeleo manual, sin errores." },
          { icono: "💬", titulo: "Comunicación directa", desc: "Chat integrado con el transportista para coordinar detalles de retiro y entrega. Sin intermediarios." },
          { icono: "🌎", titulo: "Red nacional", desc: "Más de 3.400 camioneros activos en todo el país. Cobertura en las 23 provincias y acceso a Chile, Perú y Bolivia." },
        ],
      },
      {
        titulo: "Cómo funciona para vos",
        pasos: [
          { n: "01", titulo: "Registrate", desc: "Creá tu cuenta como persona física o empresa. Si es empresa, completás razón social y CUIT para emitir documentación fiscal." },
          { n: "02", titulo: "Publicá tu carga", desc: "Ingresás los detalles del envío: qué, cuánto pesa, desde dónde, hasta dónde y cuándo está lista para retirar." },
          { n: "03", titulo: "Elegí al transportista", desc: "Recibís ofertas con precio, tiempo estimado y perfil del camionero. Ves reviews de otros dadores antes de decidir." },
          { n: "04", titulo: "Seguí y confirmá", desc: "Seguís el viaje en el mapa. Al llegar a destino, el receptor confirma la entrega y se cierra el proceso." },
        ],
      },
      {
        titulo: "¿Qué tipo de cargas podés publicar?",
        desc: "Granos, materiales de construcción, electrodomésticos, productos refrigerados, maquinaria, líquidos a granel y más. Especificás el tipo de camión requerido (camión, semi, acoplado, frigorífico, cisterna) y los certificados necesarios del transportista.",
      },
    ],
    cta: "Quiero registrarme como dador",
  },
};

type Tipo = keyof typeof CONTENIDO;

export default async function ParaTipoPage({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const data = CONTENIDO[tipo as Tipo];
  if (!data) notFound();

  return (
    <div style={{ background: "#fff", color: "var(--color-text-primary)" }}>

      {/* Navbar */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 48px" }}>
        <Link href="/" style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", textDecoration: "none" }}>
          Carga<span style={{ color: "var(--color-brand)" }}>Back</span>
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/login?modo=login" style={{ fontSize: 13, padding: "7px 16px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-primary)", textDecoration: "none", fontWeight: 500 }}>
            Iniciar sesión
          </Link>
          <Link href={`/login?modo=registro&perfil=${data.perfil}`} style={{ fontSize: 13, padding: "7px 16px", borderRadius: "var(--border-radius-md)", background: "var(--color-brand)", color: "#fff", textDecoration: "none", fontWeight: 600 }}>
            Registrarse gratis
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: data.bg, color: "#fff", padding: "80px 48px 96px", textAlign: "center" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none", marginBottom: 32 }}>
          ← Volver al inicio
        </Link>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{data.icono}</div>
        <h1 style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5, marginBottom: 20, maxWidth: 700, margin: "0 auto 20px" }}>{data.titulo}</h1>
        <p style={{ fontSize: 19, color: "rgba(255,255,255,0.75)", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.65 }}>{data.subtitulo}</p>
        <Link href={`/login?modo=registro&perfil=${data.perfil}`} style={{ fontSize: 15, padding: "13px 32px", borderRadius: "var(--border-radius-md)", background: "#fff", color: "#0f1a16", fontWeight: 700, textDecoration: "none" }}>
          {data.cta} →
        </Link>
      </section>

      {/* Secciones */}
      {data.secciones.map((seccion, i) => (
        <section key={i} style={{ padding: "80px 48px", background: i % 2 === 0 ? "#fff" : "var(--color-background-secondary)" }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.5, marginBottom: 40, textAlign: "center" }}>{seccion.titulo}</h2>

            {"items" in seccion && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                {seccion.items!.map((item) => (
                  <div key={item.titulo} style={{ padding: 24, borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", background: "#fff" }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icono}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{item.titulo}</div>
                    <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.65 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {"pasos" in seccion && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
                {seccion.pasos!.map((paso) => (
                  <div key={paso.n} style={{ padding: 24, borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", background: "#fff" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-brand)", marginBottom: 12 }}>{paso.n}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{paso.titulo}</div>
                    <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{paso.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {"desc" in seccion && !("items" in seccion) && !("pasos" in seccion) && (
              <p style={{ fontSize: 16, color: "var(--color-text-secondary)", lineHeight: 1.7, maxWidth: 700, margin: "0 auto", textAlign: "center" }}>{seccion.desc}</p>
            )}
          </div>
        </section>
      ))}

      {/* CTA final */}
      <section style={{ background: data.bg, padding: "80px 48px", textAlign: "center", color: "#fff" }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -0.5, marginBottom: 16 }}>Empezá hoy. Es gratis.</h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", maxWidth: 440, margin: "0 auto 36px", lineHeight: 1.6 }}>
          Unite a miles de {tipo === "empresas" ? "empresas" : tipo} que ya operan en CargaBack.
        </p>
        <Link href={`/login?modo=registro&perfil=${data.perfil}`} style={{ fontSize: 15, padding: "13px 32px", borderRadius: "var(--border-radius-md)", background: "#fff", color: "#0f1a16", fontWeight: 700, textDecoration: "none" }}>
          {data.cta} →
        </Link>
      </section>

      {/* Footer simple */}
      <footer style={{ background: "var(--color-background-secondary)", borderTop: "0.5px solid var(--color-border-tertiary)", padding: "24px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", textDecoration: "none" }}>
          Carga<span style={{ color: "var(--color-brand)" }}>Back</span>
        </Link>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/para/camioneros" style={{ fontSize: 13, color: "var(--color-text-secondary)", textDecoration: "none" }}>Para camioneros</Link>
          <Link href="/para/empresas"   style={{ fontSize: 13, color: "var(--color-text-secondary)", textDecoration: "none" }}>Para empresas</Link>
          <Link href="/para/dadores"    style={{ fontSize: 13, color: "var(--color-text-secondary)", textDecoration: "none" }}>Para dadores</Link>
        </div>
        <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>© 2026 CargaBack</span>
      </footer>
    </div>
  );
}
