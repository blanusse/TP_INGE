import Link from "next/link";

export default function Home() {
  return (
    <div
      style={{ background: "var(--color-background-primary)" }}
      className="min-h-screen flex flex-col"
    >
      {/* Navbar */}
      <header
        style={{
          borderBottom: "0.5px solid var(--color-border-tertiary)",
          background: "var(--color-background-primary)",
        }}
        className="flex items-center justify-between px-8 py-4"
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          Carga<span style={{ color: "var(--color-brand)" }}>Back</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            style={{
              fontSize: 13,
              padding: "6px 14px",
              borderRadius: "var(--border-radius-md)",
              color: "var(--color-text-secondary)",
              textDecoration: "none",
            }}
          >
            Iniciar sesión
          </Link>
          <Link
            href="/login"
            style={{
              fontSize: 13,
              padding: "6px 14px",
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-brand)",
              color: "#fff",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Registrarse
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--color-brand)",
            background: "var(--color-brand-light)",
            padding: "4px 12px",
            borderRadius: 20,
            marginBottom: 24,
            display: "inline-block",
          }}
        >
          Bolsa de Cargas Digital
        </div>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            lineHeight: 1.15,
            maxWidth: 640,
            marginBottom: 20,
          }}
        >
          El viaje de vuelta también puede generar plata
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "var(--color-text-secondary)",
            maxWidth: 480,
            lineHeight: 1.6,
            marginBottom: 40,
          }}
        >
          Conectamos camioneros con dadores de carga en Argentina y toda
          Latinoamérica. Sin intermediarios. Sin viajes vacíos.
        </p>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <Link
            href="/login"
            style={{
              fontSize: 14,
              padding: "10px 24px",
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-brand)",
              color: "#fff",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Buscar cargas →
          </Link>
          <Link
            href="/login"
            style={{
              fontSize: 14,
              padding: "10px 24px",
              borderRadius: "var(--border-radius-md)",
              border: "0.5px solid var(--color-border-secondary)",
              color: "var(--color-text-primary)",
              fontWeight: 500,
              textDecoration: "none",
              background: "var(--color-background-primary)",
            }}
          >
            Publicar una carga
          </Link>
        </div>

        {/* Stats */}
        <div
          className="flex items-center gap-12 mt-20 flex-wrap justify-center"
          style={{
            borderTop: "0.5px solid var(--color-border-tertiary)",
            paddingTop: 32,
            width: "100%",
            maxWidth: 600,
          }}
        >
          {[
            { value: "3.400+", label: "Camioneros registrados" },
            { value: "1.200+", label: "Cargas este mes" },
            { value: "94%", label: "Viajes con retorno cargado" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--color-text-tertiary)",
                  marginTop: 4,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "0.5px solid var(--color-border-tertiary)",
          padding: "16px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
          Carga<span style={{ color: "var(--color-brand)" }}>Back</span> © 2026
        </span>
        <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
          Argentina · Chile · Perú · Bolivia
        </span>
      </footer>
    </div>
  );
}
