"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";

// ── Datos ────────────────────────────────────────────────────────────────────

const CARGAS_DISPONIBLES = [
  {
    id: 1, titulo: "Granos — Buenos Aires → Rosario",
    empresa: "Empresa Agro San Martín", hace: "Publicado hace 3 horas",
    precio: 285000, peso: "22.000 kg", camion: "Granelero",
    retiro: "28/03", distancia: "~320 km", rating: 4.9,
    viajes: 52, badge: "Paga puntual", destacado: true,
  },
  {
    id: 2, titulo: "Electrodomésticos — Córdoba → Santiago de Chile",
    empresa: "Importaciones Del Valle", hace: "Publicado hace 1 día",
    precio: 620000, peso: "8.400 kg", camion: "Furgón",
    retiro: "30/03", distancia: "~1.200 km", rating: 4.2,
    viajes: 18, badge: null, destacado: false,
  },
  {
    id: 3, titulo: "Materiales de construcción — Mendoza → Lima",
    empresa: "Constructora Andina", hace: "Publicado hace 2 días",
    precio: 890000, peso: "15.000 kg", camion: "Plataforma",
    retiro: "01/04", distancia: "~2.600 km", rating: 4.7,
    viajes: 34, badge: "Nuevo en plataforma", destacado: false,
  },
  {
    id: 4, titulo: "Frutas frescas — Tucumán → Buenos Aires",
    empresa: "Finca Los Nogales", hace: "Publicado hace 5 horas",
    precio: 340000, peso: "18.000 kg", camion: "Refrigerado",
    retiro: "29/03", distancia: "~1.100 km", rating: 4.6,
    viajes: 27, badge: "Paga puntual", destacado: false,
  },
];

const MIS_OFERTAS = [
  {
    id: 1, titulo: "Granos — Buenos Aires → Rosario",
    empresa: "Empresa Agro San Martín", precioBase: 285000,
    miOferta: 270000, fecha: "25/03/2026", estado: "pendiente" as const,
    nota: "Disponible a partir del 28 a la mañana.",
  },
  {
    id: 2, titulo: "Fertilizantes — Córdoba → Mendoza",
    empresa: "AgroQuímica Del Centro", precioBase: 420000,
    miOferta: 400000, fecha: "22/03/2026", estado: "aceptada" as const,
    nota: "",
  },
  {
    id: 3, titulo: "Vinos — Mendoza → Buenos Aires",
    empresa: "Bodega Clos de Chacras", precioBase: 230000,
    miOferta: 215000, fecha: "18/03/2026", estado: "rechazada" as const,
    nota: "Puedo salir el mismo día.",
  },
];

const EN_CURSO = [
  {
    id: 1, titulo: "Fertilizantes — Córdoba → Mendoza",
    empresa: "AgroQuímica Del Centro", precio: 400000,
    etapa: "En camino", progreso: 65, salida: "23/03 08:00",
    llegadaEstimada: "29/03 16:00", km: "780 km",
    coordActual: "Sobre Ruta 7, km 245",
  },
  {
    id: 2, titulo: "Electrodomésticos — Rosario → Tucumán",
    empresa: "Importadora Sur", precio: 310000,
    etapa: "Cargando", progreso: 5, salida: "29/03 07:00",
    llegadaEstimada: "31/03 18:00", km: "1.050 km",
    coordActual: "Depósito Rosario - Puerto Norte",
  },
];

// ── Tipos ────────────────────────────────────────────────────────────────────

type NavItem = "Buscar cargas" | "Mis ofertas" | "En curso" | "Mi perfil";
type SortKey = "Mayor precio" | "Menor precio" | "Más cercano" | "Fecha de retiro";

interface ModalOfertaState {
  cargaId: number;
  titulo: string;
  empresa: string;
  precioBase: number;
}

// ── Componentes menores ───────────────────────────────────────────────────────

function Stars({ value }: { value: number }) {
  return (
    <span>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < Math.floor(value) ? "#BA7517" : "var(--color-border-secondary)", fontSize: 11 }}>★</span>
      ))}
    </span>
  );
}

function Badge({ estado }: { estado: "pendiente" | "aceptada" | "rechazada" }) {
  const map = {
    pendiente: { bg: "#faeeda", color: "#854f0b", label: "Pendiente" },
    aceptada: { bg: "var(--color-brand-light)", color: "var(--color-brand-dark)", label: "Aceptada ✓" },
    rechazada: { bg: "#fef2f2", color: "#b91c1c", label: "Rechazada" },
  };
  const s = map[estado];
  return (
    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function Toast({ mensaje, onClose }: { mensaje: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 100,
      background: "var(--color-text-primary)", color: "#fff",
      padding: "12px 18px", borderRadius: "var(--border-radius-md)",
      fontSize: 13, fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span>✓</span> {mensaje}
      <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 16, padding: 0, marginLeft: 4 }}>×</button>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.35)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--color-background-primary)",
        borderRadius: "var(--border-radius-lg)",
        border: "0.5px solid var(--color-border-tertiary)",
        width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto",
        padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--color-text-tertiary)", padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Secciones ─────────────────────────────────────────────────────────────────

function SeccionBuscar({
  onOfertar,
  onAlerta,
}: {
  onOfertar: (c: ModalOfertaState) => void;
  onAlerta: () => void;
}) {
  const [tipos, setTipos] = useState(["Granel", "Plataforma"]);
  const [sortBy, setSortBy] = useState<SortKey>("Mayor precio");
  const [origen, setOrigen] = useState("Argentina");
  const [destino, setDestino] = useState("");

  const toggleTipo = (t: string) =>
    setTipos((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const cargas = [...CARGAS_DISPONIBLES].sort((a, b) => {
    if (sortBy === "Mayor precio") return b.precio - a.precio;
    if (sortBy === "Menor precio") return a.precio - b.precio;
    return 0;
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", flex: 1 }}>
      {/* Sidebar */}
      <aside style={{ background: "var(--color-background-primary)", borderRight: "0.5px solid var(--color-border-tertiary)", padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 16 }}>Filtros</div>

        {[
          { label: "Origen", value: origen, onChange: setOrigen, placeholder: "Ciudad o país..." },
          { label: "Destino", value: destino, onChange: setDestino, placeholder: "Ciudad o país..." },
        ].map(({ label, value, onChange, placeholder }) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <div style={filterLabelStyle}>{label}</div>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={filterInputStyle} />
          </div>
        ))}

        <div style={{ marginBottom: 16 }}>
          <div style={filterLabelStyle}>Tipo de carga</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Granel", "Refrigerado", "General", "Plataforma", "Peligroso"].map((t) => {
              const on = tipos.includes(t);
              return (
                <button key={t} onClick={() => toggleTipo(t)} style={{
                  fontSize: 12, padding: "4px 10px", borderRadius: 20, cursor: "pointer",
                  border: on ? "0.5px solid var(--color-brand)" : "0.5px solid var(--color-border-secondary)",
                  background: on ? "var(--color-brand-light)" : "transparent",
                  color: on ? "var(--color-brand-dark)" : "var(--color-text-secondary)",
                  fontWeight: on ? 500 : 400,
                }}>{t}</button>
              );
            })}
          </div>
        </div>

        <button onClick={onAlerta} style={{
          width: "100%", fontSize: 13, padding: "8px",
          borderRadius: "var(--border-radius-md)", background: "var(--color-brand)",
          border: "none", color: "#fff", cursor: "pointer", fontWeight: 500,
        }}>
          Guardar alerta
        </button>
      </aside>

      {/* Lista */}
      <main style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Ordenar por</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            style={{ fontSize: 13, padding: "5px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: "pointer" }}
          >
            <option>Mayor precio</option>
            <option>Menor precio</option>
            <option>Más cercano</option>
            <option>Fecha de retiro</option>
          </select>
          <span style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginLeft: "auto" }}>
            {cargas.length} cargas encontradas
          </span>
        </div>

        {cargas.map((c) => (
          <div key={c.id} style={{
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderLeft: c.destacado ? "3px solid var(--color-brand)" : undefined,
            borderRadius: c.destacado ? "0 var(--border-radius-lg) var(--border-radius-lg) 0" : "var(--border-radius-lg)",
            padding: 14, marginBottom: 10, cursor: "pointer",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{c.titulo}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{c.empresa} · {c.hace}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: "var(--color-brand-dark)" }}>${c.precio.toLocaleString("es-AR")}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Precio base</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10, marginTop: 6 }}>
              {[["Peso", c.peso], ["Camión", c.camion], ["Retiro", c.retiro], ["Distancia", c.distancia]].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 1 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-primary)" }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                <Stars value={c.rating} /> {c.rating} · {c.viajes} viajes
                {c.badge && <span style={{ color: "var(--color-brand-dark)" }}> · {c.badge}</span>}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onOfertar({ cargaId: c.id, titulo: c.titulo, empresa: c.empresa, precioBase: c.precio }); }}
                style={{ fontSize: 12, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-brand)", background: "transparent", color: "var(--color-brand-dark)", cursor: "pointer", fontWeight: 500 }}
              >
                Ofertar →
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

function SeccionMisOfertas({ onToast }: { onToast: (m: string) => void }) {
  const [ofertas, setOfertas] = useState(MIS_OFERTAS);

  const cancelar = (id: number) => {
    setOfertas((prev) => prev.filter((o) => o.id !== id));
    onToast("Oferta cancelada.");
  };

  return (
    <main style={{ padding: 20, flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 16 }}>Mis ofertas</div>
      {ofertas.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>No tenés ofertas activas.</div>
      )}
      {ofertas.map((o) => (
        <div key={o.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{o.titulo}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{o.empresa} · {o.fecha}</div>
            </div>
            <Badge estado={o.estado} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>Precio base del dador</div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>${o.precioBase.toLocaleString("es-AR")}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>Tu oferta</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-brand-dark)" }}>${o.miOferta.toLocaleString("es-AR")}</div>
            </div>
          </div>
          {o.nota && (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 10, padding: "8px 10px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)" }}>
              &ldquo;{o.nota}&rdquo;
            </div>
          )}
          {o.estado === "pendiente" && (
            <div style={{ marginTop: 10, textAlign: "right" }}>
              <button onClick={() => cancelar(o.id)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid #fecaca", background: "#fef2f2", color: "#b91c1c", cursor: "pointer" }}>
                Cancelar oferta
              </button>
            </div>
          )}
        </div>
      ))}
    </main>
  );
}

function SeccionEnCurso() {
  return (
    <main style={{ padding: 20, flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 16 }}>Viajes en curso</div>
      {EN_CURSO.map((v) => (
        <div key={v.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{v.titulo}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{v.empresa}</div>
            </div>
            <span style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500,
              background: v.etapa === "En camino" ? "var(--color-brand-light)" : "#faeeda",
              color: v.etapa === "En camino" ? "var(--color-brand-dark)" : "#854f0b",
            }}>{v.etapa}</span>
          </div>

          {/* Barra de progreso */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Progreso del viaje</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-brand-dark)" }}>{v.progreso}%</span>
            </div>
            <div style={{ height: 6, background: "var(--color-background-secondary)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${v.progreso}%`, background: "var(--color-brand)", borderRadius: 3, transition: "width 0.5s ease" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
            {[["Salida", v.salida], ["Llegada est.", v.llegadaEstimada], ["Distancia", v.km], ["Ubicación actual", v.coordActual]].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-primary)" }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button style={{ fontSize: 12, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
              Ver mapa
            </button>
            <button style={{ fontSize: 12, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
              Contactar dador
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}

function SeccionPerfil({ onToast }: { onToast: (m: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState("Alejandro Rodríguez");
  const [telefono, setTelefono] = useState("+54 9 11 4523-7891");

  return (
    <main style={{ padding: 20, flex: 1, maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>Mi perfil</div>
        <button
          onClick={() => {
            if (editando) onToast("Perfil actualizado.");
            setEditando(!editando);
          }}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: editando ? "var(--color-brand)" : "transparent", color: editando ? "#fff" : "var(--color-text-primary)", cursor: "pointer", fontWeight: editando ? 500 : 400 }}
        >
          {editando ? "Guardar cambios" : "Editar"}
        </button>
      </div>

      {/* Card principal */}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "var(--color-brand-dark)" }}>AR</div>
          <div>
            {editando
              ? <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ fontSize: 18, fontWeight: 600, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", padding: "4px 8px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" }} />
              : <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-primary)" }}>{nombre}</div>
            }
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
              Camionero independiente
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--color-brand-light)", color: "var(--color-brand-dark)", fontWeight: 500 }}>Verificado ✓</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 14 }}>
          {[["Calificación", "4.8 ⭐"], ["Viajes completados", "127"], ["En plataforma desde", "Mar 2024"]].map(([label, val]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-primary)" }}>{val}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Datos del camión */}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 12 }}>Datos del camión</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[["Tipo", "Granelero"], ["Marca / Modelo", "Scania R 450"], ["Año", "2021"], ["Patente", "AB 123 CD"], ["Capacidad", "30.000 kg"], ["Habilitación RENSPA", "Vigente"]].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Datos de contacto */}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 12 }}>Contacto</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 4 }}>Teléfono</div>
            {editando
              ? <input value={telefono} onChange={(e) => setTelefono(e.target.value)} style={{ fontSize: 13, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", padding: "6px 8px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", width: "100%" }} />
              : <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{telefono}</div>
            }
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 4 }}>Email</div>
            <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>alejandro.r@gmail.com</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        style={{ marginTop: 20, fontSize: 13, padding: "8px 16px", borderRadius: "var(--border-radius-md)", border: "0.5px solid #fecaca", background: "#fef2f2", color: "#b91c1c", cursor: "pointer" }}
      >
        Cerrar sesión
      </button>
    </main>
  );
}

// ── Modal Ofertar ─────────────────────────────────────────────────────────────

function ModalOfertar({ info, onClose, onEnviar }: {
  info: ModalOfertaState;
  onClose: () => void;
  onEnviar: () => void;
}) {
  const [precio, setPrecio] = useState(info.precioBase.toString());
  const [nota, setNota] = useState("");
  const [disponible, setDisponible] = useState("");

  const diferencia = parseInt(precio || "0") - info.precioBase;
  const diff = isNaN(diferencia) ? 0 : diferencia;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onEnviar();
    onClose();
  };

  return (
    <Modal title="Hacer una oferta" onClose={onClose}>
      <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 12px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{info.titulo}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{info.empresa}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 6 }}>
          Precio base del dador: <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>${info.precioBase.toLocaleString("es-AR")}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>
            Tu precio ofertado (ARS)
          </label>
          <input
            type="number"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="0"
            required
            style={{ width: "100%", fontSize: 20, fontWeight: 600, padding: "10px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" }}
          />
          {precio && (
            <div style={{ fontSize: 12, marginTop: 6, color: diff > 0 ? "#b91c1c" : diff < 0 ? "var(--color-brand-dark)" : "var(--color-text-tertiary)" }}>
              {diff === 0 ? "Igual al precio base" : diff > 0 ? `$${diff.toLocaleString("es-AR")} por encima del precio base` : `$${Math.abs(diff).toLocaleString("es-AR")} por debajo del precio base`}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>
            Disponibilidad de salida
          </label>
          <input
            type="text"
            value={disponible}
            onChange={(e) => setDisponible(e.target.value)}
            placeholder="ej: Disponible el 28/03 a partir de las 8hs"
            style={{ width: "100%", fontSize: 13, padding: "9px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>
            Nota para el dador (opcional)
          </label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            placeholder="Contale algo sobre tu experiencia con este tipo de carga..."
            style={{ width: "100%", fontSize: 13, padding: "9px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
            Cancelar
          </button>
          <button type="submit" style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
            Enviar oferta →
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CamioneroDashboard() {
  const [navActivo, setNavActivo] = useState<NavItem>("Buscar cargas");
  const [modalOferta, setModalOferta] = useState<ModalOfertaState | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const mostrarToast = (msg: string) => setToast(msg);

  return (
    <div style={{ background: "var(--color-background-primary)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Topbar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/" style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", textDecoration: "none" }}>
            Carga<span style={{ color: "var(--color-brand)" }}>Back</span>
          </Link>
          <nav style={{ display: "flex", gap: 4 }}>
            {(["Buscar cargas", "Mis ofertas", "En curso", "Mi perfil"] as NavItem[]).map((item) => (
              <button key={item} onClick={() => setNavActivo(item)} style={{
                fontSize: 13, padding: "6px 12px", borderRadius: "var(--border-radius-md)",
                border: "none", cursor: "pointer",
                background: navActivo === item ? "var(--color-background-secondary)" : "transparent",
                color: navActivo === item ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                fontWeight: navActivo === item ? 500 : 400,
              }}>
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Camión disponible</span>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-brand)" }} />
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--color-brand-dark)" }}>AR</div>
        </div>
      </header>

      {/* Contenido según nav */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--color-background-tertiary)" }}>
        {navActivo === "Buscar cargas" && (
          <SeccionBuscar
            onOfertar={(c) => setModalOferta(c)}
            onAlerta={() => mostrarToast("¡Alerta guardada! Te avisamos cuando aparezca una carga que te interese.")}
          />
        )}
        {navActivo === "Mis ofertas" && <SeccionMisOfertas onToast={mostrarToast} />}
        {navActivo === "En curso" && <SeccionEnCurso />}
        {navActivo === "Mi perfil" && <SeccionPerfil onToast={mostrarToast} />}
      </div>

      {/* Modal ofertar */}
      {modalOferta && (
        <ModalOfertar
          info={modalOferta}
          onClose={() => setModalOferta(null)}
          onEnviar={() => mostrarToast("¡Oferta enviada! El dador recibirá tu propuesta.")}
        />
      )}

      {/* Toast */}
      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Estilos auxiliares ────────────────────────────────────────────────────────
const filterLabelStyle: React.CSSProperties = {
  fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 6,
  textTransform: "uppercase", letterSpacing: "0.04em",
};
const filterInputStyle: React.CSSProperties = {
  width: "100%", fontSize: 13, padding: "7px 10px",
  borderRadius: "var(--border-radius-md)",
  border: "0.5px solid var(--color-border-secondary)",
  background: "var(--color-background-secondary)",
  color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box",
};
