"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";

// ── Datos ────────────────────────────────────────────────────────────────────

const CARGAS_PUBLICADAS = [
  {
    id: 1, titulo: "Granos — Buenos Aires → Rosario",
    hace: "Publicado hace 3 horas", peso: "22.000 kg",
    tipoCamion: "Granelero", retiro: "28/03/2026", ofertas: 3,
    camioneros: ["AR", "LG", "+1"],
    ofertasDetalle: [
      { id: 1, nombre: "Alejandro Rodríguez", iniciales: "AR", rating: 4.9, viajes: 52, precio: 270000, nota: "Disponible desde el 28 temprano." },
      { id: 2, nombre: "Luis González", iniciales: "LG", rating: 4.6, viajes: 89, precio: 285000, nota: "" },
      { id: 3, nombre: "Roberto Paz", iniciales: "RP", rating: 4.3, viajes: 21, precio: 260000, nota: "Salida flexible, camión propio." },
    ],
  },
  {
    id: 2, titulo: "Electrodomésticos — Córdoba → Santiago de Chile",
    hace: "Publicado hace 1 día", peso: "8.400 kg",
    tipoCamion: "Furgón cerrado", retiro: "30/03/2026", ofertas: 1,
    camioneros: ["MF"],
    ofertasDetalle: [
      { id: 1, nombre: "Martín Ferreyra", iniciales: "MF", rating: 4.7, viajes: 38, precio: 600000, nota: "Hago el cruce de Andes seguido." },
    ],
  },
  {
    id: 3, titulo: "Materiales de construcción — Mendoza → Lima",
    hace: "Publicado hace 2 días", peso: "15.000 kg",
    tipoCamion: "Plataforma", retiro: "01/04/2026", ofertas: 0,
    camioneros: [], ofertasDetalle: [],
  },
];

const HISTORIAL = [
  { id: 1, titulo: "Granos — Buenos Aires → Rosario", fecha: "15/03/2026", camionero: "Martín Ferreyra", precio: 275000, rating: 5 },
  { id: 2, titulo: "Vidrio — Córdoba → Buenos Aires", fecha: "02/03/2026", camionero: "Jorge López", precio: 420000, rating: 4 },
  { id: 3, titulo: "Ropa — Buenos Aires → Mendoza", fecha: "18/02/2026", camionero: "Alejandro Rodríguez", precio: 310000, rating: 5 },
];

const CAMIONEROS_FAVORITOS = [
  { id: 1, nombre: "Alejandro Rodríguez", iniciales: "AR", rating: 4.9, viajes: 52, camion: "Granelero", zona: "Buenos Aires" },
  { id: 2, nombre: "Martín Ferreyra", iniciales: "MF", rating: 4.7, viajes: 38, camion: "Furgón cerrado", zona: "Córdoba" },
  { id: 3, nombre: "Jorge López", iniciales: "JL", rating: 4.5, viajes: 64, camion: "Plataforma", zona: "Mendoza" },
];

// ── Tipos ────────────────────────────────────────────────────────────────────

type NavItem = "Mis cargas" | "Historial" | "Camioneros" | "Facturación";
type TabItem = "Todas" | "Con ofertas" | "Sin ofertas";

interface Oferta { id: number; nombre: string; iniciales: string; rating: number; viajes: number; precio: number; nota: string; }
interface Carga { id: number; titulo: string; hace: string; peso: string; tipoCamion: string; retiro: string; ofertas: number; camioneros: string[]; ofertasDetalle: Oferta[]; }

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
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--color-text-tertiary)", padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BadgeOfertas({ n }: { n: number }) {
  if (n === 0) return <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 500, background: "#f1efe8", color: "#5f5e5a" }}>Sin ofertas</span>;
  if (n === 1) return <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 500, background: "#faeeda", color: "#854f0b" }}>1 oferta</span>;
  return <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 500, background: "var(--color-brand-light)", color: "var(--color-brand-dark)" }}>{n} ofertas</span>;
}

// ── Modal: Publicar carga ─────────────────────────────────────────────────────

function ModalPublicar({ onClose, onPublicar }: { onClose: () => void; onPublicar: () => void }) {
  const [form, setForm] = useState({ origen: "", destino: "", tipoCarga: "General", tipoCamion: "Cualquiera", peso: "", precio: "", retiro: "", descripcion: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onPublicar();
    onClose();
  };

  return (
    <Modal title="Publicar nueva carga" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Origen *</label>
            <input required value={form.origen} onChange={(e) => set("origen", e.target.value)} placeholder="Ciudad, provincia" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Destino *</label>
            <input required value={form.destino} onChange={(e) => set("destino", e.target.value)} placeholder="Ciudad, país" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Tipo de carga</label>
            <select value={form.tipoCarga} onChange={(e) => set("tipoCarga", e.target.value)} style={selectStyle}>
              {["General", "Granel", "Refrigerado", "Plataforma", "Peligroso", "Frágil"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Camión requerido</label>
            <select value={form.tipoCamion} onChange={(e) => set("tipoCamion", e.target.value)} style={selectStyle}>
              {["Cualquiera", "Granelero", "Furgón cerrado", "Plataforma", "Refrigerado", "Cisterna"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Peso estimado (kg) *</label>
            <input required type="number" value={form.peso} onChange={(e) => set("peso", e.target.value)} placeholder="ej: 22000" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Precio base (ARS) *</label>
            <input required type="number" value={form.precio} onChange={(e) => set("precio", e.target.value)} placeholder="ej: 280000" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Fecha de retiro *</label>
            <input required type="date" value={form.retiro} onChange={(e) => set("retiro", e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Descripción adicional</label>
          <textarea value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} rows={3} placeholder="Detalles sobre la carga, acceso, horarios, contacto en destino..." style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" } as React.CSSProperties} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
            Cancelar
          </button>
          <button type="submit" style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
            Publicar carga →
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Modal: Ver ofertas ────────────────────────────────────────────────────────

function ModalVerOfertas({ carga, onClose, onAceptar, onRechazar }: {
  carga: Carga;
  onClose: () => void;
  onAceptar: (nombre: string) => void;
  onRechazar: (nombre: string) => void;
}) {
  const [aceptada, setAceptada] = useState<number | null>(null);
  const [rechazadas, setRechazadas] = useState<number[]>([]);

  return (
    <Modal title={`Ofertas para: ${carga.titulo}`} onClose={onClose}>
      {carga.ofertasDetalle.length === 0 && (
        <div style={{ textAlign: "center", padding: 24, color: "var(--color-text-tertiary)", fontSize: 14 }}>Sin ofertas todavía.</div>
      )}
      {carga.ofertasDetalle.map((o) => {
        const estaAceptada = aceptada === o.id;
        const estaRechazada = rechazadas.includes(o.id);
        return (
          <div key={o.id} style={{
            border: `0.5px solid ${estaAceptada ? "var(--color-brand)" : "var(--color-border-tertiary)"}`,
            borderRadius: "var(--border-radius-md)", padding: 14, marginBottom: 10,
            background: estaAceptada ? "var(--color-brand-light)" : estaRechazada ? "var(--color-background-secondary)" : "var(--color-background-primary)",
            opacity: estaRechazada ? 0.5 : 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--color-text-info)" }}>{o.iniciales}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{o.nombre}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                  <Stars value={o.rating} /> {o.rating} · {o.viajes} viajes
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-brand-dark)" }}>${o.precio.toLocaleString("es-AR")}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Oferta</div>
              </div>
            </div>
            {o.nota && (
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "6px 10px", background: "var(--color-background-tertiary)", borderRadius: "var(--border-radius-md)", marginBottom: 10 }}>
                &ldquo;{o.nota}&rdquo;
              </div>
            )}
            {!estaAceptada && !estaRechazada && aceptada === null && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setRechazadas((prev) => [...prev, o.id]); onRechazar(o.nombre); }}
                  style={{ flex: 1, fontSize: 12, padding: "6px", borderRadius: "var(--border-radius-md)", border: "0.5px solid #fecaca", background: "#fef2f2", color: "#b91c1c", cursor: "pointer" }}
                >
                  Rechazar
                </button>
                <button
                  onClick={() => { setAceptada(o.id); onAceptar(o.nombre); }}
                  style={{ flex: 2, fontSize: 12, padding: "6px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}
                >
                  Aceptar oferta ✓
                </button>
              </div>
            )}
            {estaAceptada && (
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-brand-dark)", textAlign: "center" }}>✓ Oferta aceptada</div>
            )}
          </div>
        );
      })}
      <button onClick={onClose} style={{ width: "100%", marginTop: 8, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
        Cerrar
      </button>
    </Modal>
  );
}

// ── Secciones ─────────────────────────────────────────────────────────────────

const METRICAS = [
  { label: "Cargas activas", valor: "4", sub: "2 con ofertas nuevas" },
  { label: "Ofertas recibidas", valor: "11", sub: "Esta semana" },
  { label: "En tránsito", valor: "2", sub: "Llegan en 48hs" },
  { label: "Completados", valor: "38", sub: "Último mes" },
];

function SeccionMisCargas({
  onPublicar,
  onVerOfertas,
  onDestacado,
}: {
  onPublicar: () => void;
  onVerOfertas: (c: Carga) => void;
  onDestacado: (titulo: string) => void;
}) {
  const [tab, setTab] = useState<TabItem>("Todas");

  const cargas = tab === "Con ofertas" ? CARGAS_PUBLICADAS.filter((c) => c.ofertas > 0)
    : tab === "Sin ofertas" ? CARGAS_PUBLICADAS.filter((c) => c.ofertas === 0)
    : CARGAS_PUBLICADAS;

  return (
    <main style={{ padding: 20, flex: 1 }}>
      {/* Métricas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 24 }}>
        {METRICAS.map((m) => (
          <div key={m.label} style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-md)", padding: "14px 16px", border: "0.5px solid var(--color-border-tertiary)" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: "var(--color-text-primary)" }}>{m.valor}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>Cargas publicadas</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex" }}>
            {(["Todas", "Con ofertas", "Sin ofertas"] as TabItem[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                fontSize: 13, padding: "7px 14px", border: "none", cursor: "pointer", background: "transparent",
                borderBottom: tab === t ? "2px solid var(--color-brand)" : "2px solid transparent",
                color: tab === t ? "var(--color-brand)" : "var(--color-text-secondary)",
                fontWeight: tab === t ? 500 : 400,
              }}>{t}</button>
            ))}
          </div>
          <button onClick={onPublicar} style={{ fontSize: 13, padding: "7px 14px", borderRadius: "var(--border-radius-md)", background: "var(--color-brand)", border: "none", color: "#fff", fontWeight: 500, cursor: "pointer" }}>
            + Publicar carga
          </button>
        </div>
      </div>

      {/* Cards */}
      {cargas.map((c) => (
        <div key={c.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{c.titulo}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{c.hace}</div>
            </div>
            <BadgeOfertas n={c.ofertas} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
            {[["Peso", c.peso], ["Tipo de camión", c.tipoCamion], ["Fecha de retiro", c.retiro]].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            {c.ofertas > 0 ? (
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex" }}>
                  {c.camioneros.map((ini, idx) => (
                    <div key={idx} style={{ width: 22, height: 22, borderRadius: "50%", border: "1.5px solid var(--color-background-primary)", background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--color-text-info)", marginLeft: idx === 0 ? 0 : -5 }}>{ini}</div>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: 8 }}>
                  {c.ofertas} {c.ofertas === 1 ? "camionero ofertó" : "camioneros ofertaron"}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Esperando camioneros...</span>
            )}
            <button
              onClick={() => c.ofertas > 0 ? onVerOfertas(c) : onDestacado(c.titulo)}
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}
            >
              {c.ofertas > 0 ? "Ver ofertas →" : "Destacar carga →"}
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}

function SeccionHistorial() {
  return (
    <main style={{ padding: 20, flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 16 }}>Historial de envíos</div>
      {HISTORIAL.map((h) => (
        <div key={h.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{h.titulo}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{h.fecha} · {h.camionero}</div>
            </div>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 500, background: "var(--color-brand-light)", color: "var(--color-brand-dark)" }}>Completado ✓</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>${h.precio.toLocaleString("es-AR")}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Tu calificación: <Stars value={h.rating} /> {h.rating}/5
            </div>
          </div>
        </div>
      ))}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 4 }}>Total gastado este mes</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: "var(--color-text-primary)" }}>${(1005000).toLocaleString("es-AR")}</div>
      </div>
    </main>
  );
}

function SeccionCamioneros({ onToast }: { onToast: (m: string) => void }) {
  return (
    <main style={{ padding: 20, flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 16 }}>Mis camioneros de confianza</div>
      {CAMIONEROS_FAVORITOS.map((c) => (
        <div key={c.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "var(--color-brand-dark)", flexShrink: 0 }}>{c.iniciales}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{c.nombre}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
              <Stars value={c.rating} /> {c.rating} · {c.viajes} viajes · {c.camion} · {c.zona}
            </div>
          </div>
          <button
            onClick={() => onToast(`Invitación enviada a ${c.nombre}.`)}
            style={{ fontSize: 12, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-brand)", background: "transparent", color: "var(--color-brand-dark)", cursor: "pointer", fontWeight: 500 }}
          >
            Invitar a cotizar
          </button>
        </div>
      ))}
    </main>
  );
}

function SeccionFacturacion() {
  const facturas = [
    { id: "F-2026-038", fecha: "28/03/2026", concepto: "Granos BA→Rosario", monto: 275000, estado: "Pagada" },
    { id: "F-2026-029", fecha: "15/03/2026", concepto: "Vidrio Córdoba→BsAs", monto: 420000, estado: "Pagada" },
    { id: "F-2026-021", fecha: "02/03/2026", concepto: "Ropa BsAs→Mendoza", monto: 310000, estado: "Pagada" },
  ];
  return (
    <main style={{ padding: 20, flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>Facturación</div>
        <button style={{ fontSize: 13, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
          Descargar todas
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[["Gasto este mes", "$1.005.000"], ["Facturas emitidas", "3"]].map(([label, val]) => (
          <div key={label} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: "var(--color-text-primary)" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr 1fr 80px", gap: 0, borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "10px 16px" }}>
          {["N°", "Fecha", "Concepto", "Monto", "Estado"].map((h) => (
            <div key={h} style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</div>
          ))}
        </div>
        {facturas.map((f, idx) => (
          <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr 1fr 80px", gap: 0, padding: "12px 16px", borderBottom: idx < facturas.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{f.id}</div>
            <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{f.fecha}</div>
            <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{f.concepto}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>${f.monto.toLocaleString("es-AR")}</div>
            <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, fontWeight: 500, background: "var(--color-brand-light)", color: "var(--color-brand-dark)" }}>{f.estado}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function DadorDashboard() {
  const [navActivo, setNavActivo] = useState<NavItem>("Mis cargas");
  const [modalPublicar, setModalPublicar] = useState(false);
  const [modalOfertas, setModalOfertas] = useState<Carga | null>(null);
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
            {(["Mis cargas", "Historial", "Camioneros", "Facturación"] as NavItem[]).map((item) => (
              <button key={item} onClick={() => setNavActivo(item)} style={{ fontSize: 13, padding: "6px 12px", borderRadius: "var(--border-radius-md)", border: "none", cursor: "pointer", background: navActivo === item ? "var(--color-background-secondary)" : "transparent", color: navActivo === item ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: navActivo === item ? 500 : 400 }}>
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setModalPublicar(true)} style={{ fontSize: 13, padding: "7px 14px", borderRadius: "var(--border-radius-md)", background: "var(--color-brand)", border: "none", color: "#fff", fontWeight: 500, cursor: "pointer" }}>
            + Publicar carga
          </button>
          <button onClick={() => signOut({ callbackUrl: "/" })} title="Cerrar sesión" style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--color-background-info)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--color-text-info)", cursor: "pointer" }}>
            JM
          </button>
        </div>
      </header>

      {/* Contenido */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--color-background-tertiary)" }}>
        {navActivo === "Mis cargas" && (
          <SeccionMisCargas
            onPublicar={() => setModalPublicar(true)}
            onVerOfertas={(c) => setModalOfertas(c)}
            onDestacado={(titulo) => mostrarToast(`Carga "${titulo.split("—")[0].trim()}" destacada. Más camioneros la verán primero.`)}
          />
        )}
        {navActivo === "Historial" && <SeccionHistorial />}
        {navActivo === "Camioneros" && <SeccionCamioneros onToast={mostrarToast} />}
        {navActivo === "Facturación" && <SeccionFacturacion />}
      </div>

      {/* Modales */}
      {modalPublicar && (
        <ModalPublicar
          onClose={() => setModalPublicar(false)}
          onPublicar={() => mostrarToast("¡Carga publicada! Los camioneros ya pueden verte.")}
        />
      )}
      {modalOfertas && (
        <ModalVerOfertas
          carga={modalOfertas}
          onClose={() => setModalOfertas(null)}
          onAceptar={(nombre) => mostrarToast(`Oferta de ${nombre} aceptada. Te contactaremos para coordinar.`)}
          onRechazar={(nombre) => mostrarToast(`Oferta de ${nombre} rechazada.`)}
        />
      )}

      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
