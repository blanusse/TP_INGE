"use client";

import Link from "next/link";
import { useState } from "react";

const CARGAS = [
  {
    id: 1,
    titulo: "Granos — Buenos Aires → Rosario",
    hace: "Publicado hace 3 horas",
    peso: "22.000 kg",
    tipoCamion: "Granelero",
    retiro: "28/03/2026",
    ofertas: 3,
    camioneros: ["AR", "LG", "+1"],
  },
  {
    id: 2,
    titulo: "Electrodomésticos — Córdoba → Santiago de Chile",
    hace: "Publicado hace 1 día",
    peso: "8.400 kg",
    tipoCamion: "Furgón cerrado",
    retiro: "30/03/2026",
    ofertas: 1,
    camioneros: ["MF"],
  },
  {
    id: 3,
    titulo: "Materiales de construcción — Mendoza → Lima",
    hace: "Publicado hace 2 días",
    peso: "15.000 kg",
    tipoCamion: "Plataforma",
    retiro: "01/04/2026",
    ofertas: 0,
    camioneros: [],
  },
];

const METRICAS = [
  { label: "Cargas activas", valor: "4", sub: "2 con ofertas nuevas" },
  { label: "Ofertas recibidas", valor: "11", sub: "Esta semana" },
  { label: "En tránsito", valor: "2", sub: "Llegan en 48hs" },
  { label: "Completados", valor: "38", sub: "Último mes" },
];

function BadgeOfertas({ n }: { n: number }) {
  if (n === 0) {
    return (
      <span
        style={{
          fontSize: 11,
          padding: "3px 9px",
          borderRadius: 20,
          fontWeight: 500,
          background: "#f1efe8",
          color: "#5f5e5a",
        }}
      >
        Sin ofertas
      </span>
    );
  }
  if (n === 1) {
    return (
      <span
        style={{
          fontSize: 11,
          padding: "3px 9px",
          borderRadius: 20,
          fontWeight: 500,
          background: "#faeeda",
          color: "#854f0b",
        }}
      >
        1 oferta
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: 11,
        padding: "3px 9px",
        borderRadius: 20,
        fontWeight: 500,
        background: "var(--color-brand-light)",
        color: "var(--color-brand-dark)",
      }}
    >
      {n} ofertas
    </span>
  );
}

export default function DadorDashboard() {
  const [navActivo, setNavActivo] = useState("Mis cargas");
  const [tabActivo, setTabActivo] = useState("Todas");

  const cargasFiltradas =
    tabActivo === "Con ofertas"
      ? CARGAS.filter((c) => c.ofertas > 0)
      : tabActivo === "Sin ofertas"
      ? CARGAS.filter((c) => c.ofertas === 0)
      : CARGAS;

  return (
    <div
      style={{
        background: "var(--color-background-primary)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Topbar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "0.5px solid var(--color-border-tertiary)",
          background: "var(--color-background-primary)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link
            href="/"
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              textDecoration: "none",
            }}
          >
            Carga<span style={{ color: "var(--color-brand)" }}>Back</span>
          </Link>
          <nav style={{ display: "flex", gap: 4 }}>
            {["Mis cargas", "Historial", "Camioneros", "Facturación"].map((item) => (
              <button
                key={item}
                onClick={() => setNavActivo(item)}
                style={{
                  fontSize: 13,
                  padding: "6px 12px",
                  borderRadius: "var(--border-radius-md)",
                  border: "none",
                  cursor: "pointer",
                  background:
                    navActivo === item
                      ? "var(--color-background-secondary)"
                      : "transparent",
                  color:
                    navActivo === item
                      ? "var(--color-text-primary)"
                      : "var(--color-text-secondary)",
                  fontWeight: navActivo === item ? 500 : 400,
                }}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            style={{
              fontSize: 13,
              padding: "7px 14px",
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-brand)",
              border: "none",
              color: "#fff",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            + Publicar carga
          </button>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--color-background-info)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text-info)",
            }}
          >
            JM
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main
        style={{
          padding: 20,
          background: "var(--color-background-tertiary)",
          flex: 1,
        }}
      >
        {/* Métricas */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {METRICAS.map((m) => (
            <div
              key={m.label}
              style={{
                background: "var(--color-background-primary)",
                borderRadius: "var(--border-radius-md)",
                padding: "14px 16px",
                border: "0.5px solid var(--color-border-tertiary)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  marginBottom: 6,
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                {m.valor}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-text-tertiary)",
                  marginTop: 3,
                }}
              >
                {m.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Header sección */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "var(--color-text-primary)",
            }}
          >
            Cargas publicadas
          </div>
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "0.5px solid var(--color-border-tertiary)",
            }}
          >
            {["Todas", "Con ofertas", "Sin ofertas"].map((tab) => (
              <button
                key={tab}
                onClick={() => setTabActivo(tab)}
                style={{
                  fontSize: 13,
                  padding: "8px 16px",
                  border: "none",
                  borderBottom:
                    tabActivo === tab
                      ? "2px solid var(--color-brand)"
                      : "2px solid transparent",
                  cursor: "pointer",
                  background: "transparent",
                  color:
                    tabActivo === tab
                      ? "var(--color-brand)"
                      : "var(--color-text-secondary)",
                  fontWeight: tabActivo === tab ? 500 : 400,
                  marginBottom: -1,
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Cards de cargas */}
        {cargasFiltradas.map((carga) => (
          <div
            key={carga.id}
            style={{
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-lg)",
              padding: 16,
              marginBottom: 10,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {carga.titulo}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                    marginTop: 2,
                  }}
                >
                  {carga.hace}
                </div>
              </div>
              <BadgeOfertas n={carga.ofertas} />
            </div>

            {/* Meta */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                borderTop: "0.5px solid var(--color-border-tertiary)",
                paddingTop: 10,
                marginTop: 4,
              }}
            >
              {[
                { label: "Peso", value: carga.peso },
                { label: "Tipo de camión", value: carga.tipoCamion },
                { label: "Fecha de retiro", value: carga.retiro },
              ].map((item) => (
                <div key={item.label}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-tertiary)",
                      marginBottom: 2,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer de la card */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 10,
              }}
            >
              {carga.ofertas > 0 ? (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex" }}>
                    {carga.camioneros.map((ini, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          border: "1.5px solid var(--color-background-primary)",
                          background: "var(--color-background-info)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 9,
                          fontWeight: 600,
                          color: "var(--color-text-info)",
                          marginLeft: idx === 0 ? 0 : -5,
                        }}
                      >
                        {ini}
                      </div>
                    ))}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                      marginLeft: 8,
                    }}
                  >
                    {carga.ofertas}{" "}
                    {carga.ofertas === 1 ? "camionero ofertó" : "camioneros ofertaron"}
                  </span>
                </div>
              ) : (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  Esperando camioneros...
                </span>
              )}
              <button
                style={{
                  fontSize: 12,
                  padding: "5px 10px",
                  borderRadius: "var(--border-radius-md)",
                  border: "0.5px solid var(--color-border-secondary)",
                  background: "transparent",
                  color: "var(--color-text-primary)",
                  cursor: "pointer",
                }}
              >
                {carga.ofertas > 0 ? "Ver ofertas →" : "Destacar →"}
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
