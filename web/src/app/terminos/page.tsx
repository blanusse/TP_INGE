import Link from "next/link";

export const metadata = {
  title: "Términos y condiciones — CargaBack",
  description: "Términos y condiciones de uso y política de privacidad de CargaBack.",
};

const h2Style: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: "#fff", margin: "40px 0 12px", letterSpacing: -0.3 };
const h3Style: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#fff", margin: "22px 0 8px" };
const pStyle: React.CSSProperties = { fontSize: 14, color: "rgba(255,255,255,0.72)", lineHeight: 1.7, marginBottom: 12 };
const liStyle: React.CSSProperties = { fontSize: 14, color: "rgba(255,255,255,0.72)", lineHeight: 1.7, marginBottom: 6 };

export default function TerminosPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "var(--font-ibm-plex), sans-serif" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "18px 24px" }}>
        <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontSize: 20, fontWeight: 800, color: "#fff", textDecoration: "none", letterSpacing: -0.5 }}>
            Carga<span style={{ color: "#5cb899" }}>Back</span>
          </Link>
          <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>← Volver al inicio</Link>
        </div>
      </header>

      <main style={{ maxWidth: 780, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ fontSize: 12, color: "#3a806b", fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>LEGAL</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: -0.5, marginBottom: 8 }}>Términos y condiciones</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>Última actualización: julio de 2026</p>
        <p style={pStyle}>
          Estos términos regulan el uso de la plataforma CargaBack (la &quot;Plataforma&quot;), un servicio que conecta
          dadores de carga con transportistas en Argentina. Al registrarte o usar la Plataforma aceptás estos
          términos en su totalidad. Si no estás de acuerdo, no uses la Plataforma.
        </p>

        <h2 style={h2Style}>1. Objeto del servicio</h2>
        <p style={pStyle}>
          CargaBack es un marketplace logístico: los <strong style={{ color: "#fff" }}>dadores de carga</strong> publican
          cargas para transportar y los <strong style={{ color: "#fff" }}>transportistas</strong> (individuales, flotas y
          sus empleados) realizan ofertas para transportarlas. CargaBack facilita el contacto, la negociación, el pago y
          el seguimiento del viaje, pero <strong style={{ color: "#fff" }}>no presta el servicio de transporte</strong> ni
          es parte del contrato de transporte entre las partes.
        </p>

        <h2 style={h2Style}>2. Registro y cuentas</h2>
        <ul style={{ paddingLeft: 22, marginBottom: 12 }}>
          <li style={liStyle}>Debés ser mayor de 18 años y brindar información veraz, completa y actualizada.</li>
          <li style={liStyle}>La cuenta es personal e intransferible. Sos responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada con tu cuenta.</li>
          <li style={liStyle}>Cada persona o empresa puede registrar una única cuenta por rol. CargaBack puede suspender cuentas duplicadas o con datos falsos.</li>
        </ul>

        <h2 style={h2Style}>3. Verificación de identidad y documentación</h2>
        <p style={pStyle}>
          Para operar, los transportistas deben verificar su identidad y documentación: DNI, licencia de conducir
          profesional, verificación biométrica, inscripción en el RUCCT y documentación del vehículo (cédula, VTV,
          seguro). Los dadores deben verificar su DNI o CUIT según corresponda. La verificación se realiza mediante
          proveedores automáticos y validación contra registros públicos (por ejemplo, el padrón de AFIP). CargaBack
          puede rechazar o revocar la verificación si detecta inconsistencias.
        </p>

        <h2 style={h2Style}>4. Publicación de cargas y ofertas</h2>
        <ul style={{ paddingLeft: 22, marginBottom: 12 }}>
          <li style={liStyle}>El dador es responsable de que la información de la carga (tipo, peso, valor, origen y destino) sea exacta y de que la carga sea lícita.</li>
          <li style={liStyle}>Está prohibido publicar cargas peligrosas sin la habilitación correspondiente, mercadería ilegal o información engañosa.</li>
          <li style={liStyle}>Las ofertas y contraofertas realizadas a través de la Plataforma son vinculantes una vez aceptadas por la otra parte.</li>
          <li style={liStyle}>CargaBack monitorea precios inusuales y puede marcar o retirar publicaciones sospechosas.</li>
        </ul>

        <h2 style={h2Style}>5. Pagos</h2>
        <p style={pStyle}>
          Los pagos se procesan a través de <strong style={{ color: "#fff" }}>MercadoPago</strong>. El dador paga al
          aceptar una oferta y el dinero se libera al transportista cuando la entrega se confirma con el código de
          entrega. CargaBack no almacena datos de tarjetas. Las comisiones vigentes, si las hubiera, se informan antes
          de confirmar cada pago. Los retiros de fondos de los transportistas se procesan a la cuenta que indiquen.
        </p>

        <h2 style={h2Style}>6. Seguros</h2>
        <p style={pStyle}>
          La Plataforma permite contratar coberturas de seguro para las cargas a través de productos ofrecidos en el
          catálogo. La relación contractual del seguro se establece entre el dador y la aseguradora correspondiente;
          CargaBack actúa como intermediario tecnológico. Las condiciones, exclusiones y montos de cobertura son los
          informados al momento de la cotización.
        </p>

        <h2 style={h2Style}>7. Seguimiento y ubicación en tiempo real</h2>
        <p style={pStyle}>
          Durante un viaje activo, el transportista comparte su ubicación para que el dador pueda seguir el envío.
          La ubicación solo es visible para las partes del viaje y los administradores de la Plataforma, y deja de
          compartirse al finalizar el viaje.
        </p>

        <h2 style={h2Style}>8. Calificaciones y conducta</h2>
        <ul style={{ paddingLeft: 22, marginBottom: 12 }}>
          <li style={liStyle}>Al completar un viaje, ambas partes pueden calificarse mutuamente. Las calificaciones deben ser honestas y estar basadas en la experiencia real.</li>
          <li style={liStyle}>No se tolera lenguaje ofensivo, discriminación, acoso ni amenazas en chats, reseñas o reportes.</li>
          <li style={liStyle}>Los usuarios pueden reportar conductas indebidas; el equipo de administración revisa cada reporte y puede aplicar advertencias, suspensiones o bajas definitivas.</li>
        </ul>

        <h2 style={h2Style}>9. Responsabilidad</h2>
        <p style={pStyle}>
          CargaBack pone a disposición la infraestructura tecnológica &quot;tal cual está&quot; y no garantiza la
          disponibilidad ininterrumpida del servicio. El transporte, la carga, su documentación y el cumplimiento de la
          normativa de tránsito y transporte son responsabilidad exclusiva de las partes. CargaBack no responde por
          daños, pérdidas o demoras derivadas del transporte, sin perjuicio de las coberturas de seguro contratadas.
        </p>

        <h2 style={h2Style}>10. Suspensión y terminación</h2>
        <p style={pStyle}>
          CargaBack puede suspender o dar de baja cuentas que incumplan estos términos, presenten documentación falsa,
          usen la Plataforma para fines ilícitos o dañen a otros usuarios. Podés solicitar la baja de tu cuenta en
          cualquier momento escribiendo al contacto indicado al final.
        </p>

        <h2 id="privacidad" style={{ ...h2Style, scrollMarginTop: 80 }}>11. Política de privacidad</h2>
        <h3 style={h3Style}>Qué datos recolectamos</h3>
        <ul style={{ paddingLeft: 22, marginBottom: 12 }}>
          <li style={liStyle}>Datos de registro: nombre, email, teléfono, DNI/CUIT/CUIL, rol.</li>
          <li style={liStyle}>Documentación de verificación: fotos de DNI, licencia, cédulas, VTV, seguro y RUCCT.</li>
          <li style={liStyle}>Datos operativos: cargas publicadas, ofertas, pagos, calificaciones, mensajes y reportes.</li>
          <li style={liStyle}>Ubicación del transportista durante viajes activos.</li>
        </ul>
        <h3 style={h3Style}>Para qué los usamos</h3>
        <p style={pStyle}>
          Para operar la Plataforma: verificar identidades, conectar cargas con transportistas, procesar pagos, mostrar
          el seguimiento del viaje, prevenir fraude y cumplir obligaciones legales. No vendemos tus datos a terceros.
        </p>
        <h3 style={h3Style}>Con quién los compartimos</h3>
        <ul style={{ paddingLeft: 22, marginBottom: 12 }}>
          <li style={liStyle}>MercadoPago, para procesar pagos y retiros.</li>
          <li style={liStyle}>Proveedores de verificación de identidad y de lectura de documentos.</li>
          <li style={liStyle}>La contraparte de tu viaje, que ve tu nombre, calificación y los datos necesarios para coordinar el transporte.</li>
        </ul>
        <h3 style={h3Style}>Tus derechos</h3>
        <p style={pStyle}>
          De acuerdo con la Ley 25.326 de Protección de Datos Personales, podés solicitar el acceso, la rectificación o
          la eliminación de tus datos escribiendo al contacto indicado abajo.
        </p>

        <h2 id="cookies" style={{ ...h2Style, scrollMarginTop: 80 }}>12. Cookies</h2>
        <p style={pStyle}>
          Usamos cookies estrictamente necesarias para mantener tu sesión iniciada y recordar preferencias como el tema
          claro/oscuro. No utilizamos cookies de publicidad ni de seguimiento de terceros.
        </p>

        <h2 style={h2Style}>13. Cambios y contacto</h2>
        <p style={pStyle}>
          Podemos actualizar estos términos; si el cambio es significativo, lo comunicaremos dentro de la Plataforma.
          Ante cualquier consulta escribinos a{" "}
          <a href="mailto:cargaback.int@gmail.com" style={{ color: "#5cb899", textDecoration: "none" }}>cargaback.int@gmail.com</a>.
        </p>
      </main>
    </div>
  );
}
