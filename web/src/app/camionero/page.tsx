"use client";

import Link from "next/link";
import { useState } from "react";

const CARGAS = [
  {
    id: 1,
    titulo: "Granos — Buenos Aires → Rosario",
    empresa: "Empresa Agro San Martín",
    hace: "Publicado hace 3 horas",
    precio: "$285.000",
    peso: "22.000 kg",
    camion: "Granelero",
    retiro: "28/03",
    distancia: "~320 km",
    rating: 4.9,
    viajes: 52,
    badge: "Paga puntual",
    destacado: true,
  },
  {
    id: 2,
    titulo: "Electrodomésticos — Córdoba → Santiago de Chile",
    empresa: "Importaciones Del Valle",
    hace: "Publicado hace 1 día",
    precio: "$620.000",
    peso: "8.400 kg",
    camion: "Furgón",
    retiro: "30/03",
    distancia: "~1.200 km",
    rating: 4.2,
    viajes: 18,
    badge: null,
    destacado: false,
  },
  {
    id: 3,
    titulo: "Materiales de construcción — Mendoza → Lima",
    empresa: "Constructora Andina",
    hace: "Publicado hace 2 días",
    precio: "$890.000",
    peso: "15.000 kg",
    camion: "Plataforma",
    retiro: "01/04",
    distancia: "~2.600 km",
    rating: 4.7,
    viajes: 34,
    badge: "Nuevo en plataforma",
    destacado: false,
  },
  {
    id: 4,
    titulo: "Frutas frescas — Tucumán → Buenos Aires",
    empresa: "Finca Los Nogales",
    hace: "Publicado hace 5 horas",
    precio: "$340.000",
    peso: "18.000 kg",
    camion: "Refrigerado",
    retiro: "29/03",
    distancia: "~1.100 km",
    rating: 4.6,
    viajes: 27,
    badge: "Paga puntual",
    destacado: false,
  },
];

const TIPOS_CARGA = ["Granel", "Refrigerado", "General", "Plataforma", "Peligroso"];

function StarRating({ value }: { value: number }) {
  const full = Math.floor(value);
  return (
    <span>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < full ? "#BA7517" : "#d1d5db", fontSize: 11 }}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function CamioneroDashboard() {
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>(["Granel", "Plataforma"]);
  const [sortBy, setSortBy] = useState("Mayor precio");
  const [navActivo, setNavActivo] = useState("Buscar cargas");

  const toggleTipo = (tipo: string) => {
    setTiposSeleccionados((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  };

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
            {["Buscar cargas", "Mis ofertas", "En curso", "Mi perfil"].map((item) => (
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            Camión disponible
          </span>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--color-brand)",
            }}
          />
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--color-brand-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-brand-dark)",
            }}
          >
            AR
          </div>
        </div>
      </header>

      {/* Layout principal */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          flex: 1,
          background: "var(--color-background-tertiary)",
        }}
      >
        {/* Sidebar de filtros */}
        <aside
          style={{
            background: "var(--color-background-primary)",
            borderRight: "0.5px solid var(--color-border-tertiary)",
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-primary)",
              marginBottom: 16,
            }}
          >
            Filtros
          </div>

          {/* Origen */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Origen
            </div>
            <input
              defaultValue="Argentina"
              placeholder="Ciudad o país..."
              style={{
                width: "100%",
                fontSize: 13,
                padding: "7px 10px",
                borderRadius: "var(--border-radius-md)",
                border: "0.5px solid var(--color-border-secondary)",
                background: "var(--color-background-secondary)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>

          {/* Destino */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Destino
            </div>
            <input
              placeholder="Ciudad o país..."
              style={{
                width: "100%",
                fontSize: 13,
                padding: "7px 10px",
                borderRadius: "var(--border-radius-md)",
                border: "0.5px solid var(--color-border-secondary)",
                background: "var(--color-background-secondary)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>

          {/* Tipo de carga */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Tipo de carga
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TIPOS_CARGA.map((tipo) => {
                const activo = tiposSeleccionados.includes(tipo);
                return (
                  <button
                    key={tipo}
                    onClick={() => toggleTipo(tipo)}
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 20,
                      border: activo
                        ? "0.5px solid var(--color-brand)"
                        : "0.5px solid var(--color-border-secondary)",
                      cursor: "pointer",
                      background: activo ? "var(--color-brand-light)" : "transparent",
                      color: activo ? "var(--color-brand-dark)" : "var(--color-text-secondary)",
                      fontWeight: activo ? 500 : 400,
                    }}
                  >
                    {tipo}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fecha */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Fecha de retiro
            </div>
            <input
              defaultValue="Esta semana"
              placeholder="dd/mm/aaaa"
              style={{
                width: "100%",
                fontSize: 13,
                padding: "7px 10px",
                borderRadius: "var(--border-radius-md)",
                border: "0.5px solid var(--color-border-secondary)",
                background: "var(--color-background-secondary)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>

          {/* Peso */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Peso máximo
            </div>
            <input
              defaultValue="30.000 kg"
              placeholder="kg"
              style={{
                width: "100%",
                fontSize: 13,
                padding: "7px 10px",
                borderRadius: "var(--border-radius-md)",
                border: "0.5px solid var(--color-border-secondary)",
                background: "var(--color-background-secondary)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>

          <button
            style={{
              width: "100%",
              fontSize: 13,
              padding: "8px",
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-brand)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 500,
              marginTop: 4,
            }}
          >
            Guardar alerta
          </button>
        </aside>

        {/* Lista de cargas */}
        <main style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              Ordenar por
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                fontSize: 13,
                padding: "5px 10px",
                borderRadius: "var(--border-radius-md)",
                border: "0.5px solid var(--color-border-secondary)",
                background: "var(--color-background-primary)",
                color: "var(--color-text-primary)",
                cursor: "pointer",
              }}
            >
              <option>Mayor precio</option>
              <option>Más cercano</option>
              <option>Fecha de retiro</option>
            </select>
            <span
              style={{
                fontSize: 13,
                color: "var(--color-text-tertiary)",
                marginLeft: "auto",
              }}
            >
              {CARGAS.length} cargas encontradas
            </span>
          </div>

          {CARGAS.map((carga) => (
            <div
              key={carga.id}
              style={{
                background: "var(--color-background-primary)",
                border: carga.destacado
                  ? "0.5px solid var(--color-border-tertiary)"
                  : "0.5px solid var(--color-border-tertiary)",
                borderLeft: carga.destacado
                  ? "3px solid var(--color-brand)"
                  : undefined,
                borderRadius: carga.destacado
                  ? "0 var(--border-radius-lg) var(--border-radius-lg) 0"
                  : "var(--border-radius-lg)",
                padding: 14,
                marginBottom: 10,
                cursor: "pointer",
              }}
            >
              {/* Cabecera */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 8,
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
                    {carga.empresa} · {carga.hace}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      color: "var(--color-brand-dark)",
                    }}
                  >
                    {carga.precio}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}
                  >
                    Precio base
                  </div>
                </div>
              </div>

              {/* Detalles */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 6,
                  borderTop: "0.5px solid var(--color-border-tertiary)",
                  paddingTop: 10,
                  marginTop: 6,
                }}
              >
                {[
                  { label: "Peso", value: carga.peso },
                  { label: "Camión", value: carga.camion },
                  { label: "Retiro", value: carga.retiro },
                  { label: "Distancia", value: carga.distancia },
                ].map((d) => (
                  <div key={d.label}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--color-text-tertiary)",
                        marginBottom: 1,
                      }}
                    >
                      {d.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {d.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <StarRating value={carga.rating} /> {carga.rating} ·{" "}
                  {carga.viajes} viajes
                  {carga.badge && (
                    <span style={{ color: "var(--color-brand-dark)" }}>
                      {" "}
                      · {carga.badge}
                    </span>
                  )}
                </div>
                <button
                  style={{
                    fontSize: 12,
                    padding: "6px 14px",
                    borderRadius: "var(--border-radius-md)",
                    border: "0.5px solid var(--color-brand)",
                    background: "transparent",
                    color: "var(--color-brand-dark)",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Ofertar →
                </button>
              </div>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
