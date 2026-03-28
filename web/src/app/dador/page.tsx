"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

// ── Datos ────────────────────────────────────────────────────────────────────

const CARGAS_PUBLICADAS: Carga[] = [
  {
    id: "mock-1", titulo: "Granos — Buenos Aires → Rosario",
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
    id: "mock-2", titulo: "Electrodomésticos — Córdoba → Santiago de Chile",
    hace: "Publicado hace 1 día", peso: "8.400 kg",
    tipoCamion: "Furgón cerrado", retiro: "30/03/2026", ofertas: 1,
    camioneros: ["MF"],
    ofertasDetalle: [
      { id: 1, nombre: "Martín Ferreyra", iniciales: "MF", rating: 4.7, viajes: 38, precio: 600000, nota: "Hago el cruce de Andes seguido." },
    ],
  },
  {
    id: "mock-3", titulo: "Materiales de construcción — Mendoza → Lima",
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

type NavItem = "Mis cargas" | "Historial" | "Camioneros" | "Facturación" | "Mi perfil";
type TabItem = "Todas" | "Con ofertas" | "Sin ofertas";

interface Oferta { id: number; nombre: string; iniciales: string; rating: number; viajes: number; precio: number; nota: string; }
interface Carga { id: string; titulo: string; hace: string; peso: string; tipoCamion: string; retiro: string; ofertas: number; camioneros: string[]; ofertasDetalle: Oferta[]; }

interface LoadDB {
  id: string;
  pickup_city: string;
  dropoff_city: string;
  cargo_type: string | null;
  truck_type_required: string | null;
  weight_kg: number | null;
  price_base: number | null;
  ready_at: string | null;
  description: string | null;
  status: string;
  created_at: string;
}

const TRUCK_LABEL: Record<string, string> = {
  camion:      "Furgón cerrado",
  semi:        "Plataforma",
  frigorifico: "Refrigerado",
  cisterna:    "Cisterna",
  acoplado:    "Acoplado",
  otros:       "Otros",
};

function loadToCard(load: LoadDB & { offers_count?: number }): Carga {
  const tipoCarga = load.cargo_type ?? "Carga";
  const titulo = `${tipoCarga} — ${load.pickup_city} → ${load.dropoff_city}`;
  const now = new Date();
  const created = new Date(load.created_at);
  const diffH = Math.floor((now.getTime() - created.getTime()) / 3600000);
  const diffD = Math.floor(diffH / 24);
  const hace = diffD > 0
    ? `Publicado hace ${diffD} día${diffD > 1 ? "s" : ""}`
    : diffH > 0
    ? `Publicado hace ${diffH} hora${diffH > 1 ? "s" : ""}`
    : "Publicado hace unos minutos";
  return {
    id:         load.id,
    titulo,
    hace,
    peso:       load.weight_kg ? `${load.weight_kg.toLocaleString("es-AR")} kg` : "—",
    tipoCamion: load.truck_type_required ? (TRUCK_LABEL[load.truck_type_required] ?? load.truck_type_required) : "Cualquiera",
    retiro:     load.ready_at ? new Date(load.ready_at).toLocaleDateString("es-AR") : "—",
    ofertas:    load.offers_count ?? 0,
    camioneros: [],
    ofertasDetalle: [],
  };
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

// ── Autocomplete de ubicación ─────────────────────────────────────────────────

interface GeoResult { label: string; full: string; }

function InputUbicacion({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id: string;
}) {
  const [sugerencias, setSugerencias] = useState<GeoResult[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef   = React.useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buscar = (q: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (q.length < 3) { setSugerencias([]); setAbierto(false); return; }
    timeoutRef.current = setTimeout(async () => {
      setCargando(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSugerencias(data.results ?? []);
        setAbierto(true);
      } finally {
        setCargando(false);
      }
    }, 380);
  };

  const seleccionar = (r: GeoResult) => {
    onChange(r.label);
    setSugerencias([]);
    setAbierto(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type="text"
          autoComplete="off"
          value={value}
          onChange={(e) => { onChange(e.target.value); buscar(e.target.value); }}
          placeholder={placeholder}
          style={{ ...inputStyle, paddingRight: 32 }}
        />
        {cargando && (
          <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--color-text-tertiary)" }}>⏳</div>
        )}
        {!cargando && value && (
          <button
            type="button"
            onClick={() => { onChange(""); setSugerencias([]); }}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--color-text-tertiary)", padding: 0, lineHeight: 1 }}
          >×</button>
        )}
      </div>

      {abierto && sugerencias.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-secondary)",
          borderRadius: "var(--border-radius-md)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          overflow: "hidden",
        }}>
          {sugerencias.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => seleccionar(s)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 12px", border: "none", background: "transparent",
                cursor: "pointer", textAlign: "left",
                borderBottom: i < sugerencias.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-background-secondary)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>📍</span>
              <span style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.4 }}>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {abierto && !cargando && sugerencias.length === 0 && value.length >= 3 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)",
          borderRadius: "var(--border-radius-md)", padding: "10px 12px",
          fontSize: 13, color: "var(--color-text-tertiary)",
        }}>
          Sin resultados para &ldquo;{value}&rdquo;
        </div>
      )}
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

function ModalPublicar({ onClose, onPublicar }: { onClose: () => void; onPublicar: (c: Carga) => void }) {
  const [form, setForm] = useState({ origen: "", destino: "", tipoCarga: "General", tipoCamion: "Cualquiera", peso: "", precio: "", retiro: "", descripcion: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al publicar."); return; }
      onPublicar(loadToCard(data.load));
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Publicar nueva carga" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Origen *</label>
            <InputUbicacion
              id="origen"
              value={form.origen}
              onChange={(v) => set("origen", v)}
              placeholder="Ciudad o dirección de retiro"
            />
          </div>
          <div>
            <label style={labelStyle}>Destino *</label>
            <InputUbicacion
              id="destino"
              value={form.destino}
              onChange={(v) => set("destino", v)}
              placeholder="Ciudad o dirección de entrega"
            />
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

        {error && <div style={{ fontSize: 13, color: "#b91c1c", background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
            Cancelar
          </button>
          <button type="submit" disabled={loading} style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "none", background: loading ? "#aaa" : "var(--color-brand)", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}>
            {loading ? "Publicando..." : "Publicar carga →"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Modal: Ver ofertas ────────────────────────────────────────────────────────

interface OfertaSeleccionada { oferta: Oferta; cargaTitulo: string; cargaId: string; }

function ModalVerOfertas({ carga, onClose, onRechazar, onIniciarPago }: {
  carga: Carga;
  onClose: () => void;
  onRechazar: (nombre: string) => void;
  onIniciarPago: (sel: OfertaSeleccionada) => void;
}) {
  const [rechazadas, setRechazadas] = useState<number[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>(carga.ofertasDetalle);
  const [loadingOfertas, setLoadingOfertas] = useState(true);

  React.useEffect(() => {
    fetch(`/api/offers?loadId=${carga.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.offers) setOfertas(d.offers); })
      .catch(() => {})
      .finally(() => setLoadingOfertas(false));
  }, [carga.id]);

  return (
    <Modal title={`Ofertas para: ${carga.titulo}`} onClose={onClose}>
      {loadingOfertas && <div style={{ textAlign: "center", padding: 24, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando ofertas...</div>}
      {!loadingOfertas && ofertas.length === 0 && (
        <div style={{ textAlign: "center", padding: 24, color: "var(--color-text-tertiary)", fontSize: 14 }}>Sin ofertas todavía.</div>
      )}
      {!loadingOfertas && ofertas.map((o) => {
        const estaRechazada = rechazadas.includes(o.id);
        return (
          <div key={o.id} style={{
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-md)", padding: 14, marginBottom: 10,
            background: estaRechazada ? "var(--color-background-secondary)" : "var(--color-background-primary)",
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
            {!estaRechazada && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setRechazadas((prev) => [...prev, o.id]); onRechazar(o.nombre); }}
                  style={{ flex: 1, fontSize: 12, padding: "6px", borderRadius: "var(--border-radius-md)", border: "0.5px solid #fecaca", background: "#fef2f2", color: "#b91c1c", cursor: "pointer" }}
                >
                  Rechazar
                </button>
                <button
                  onClick={() => { onIniciarPago({ oferta: o, cargaTitulo: carga.titulo, cargaId: carga.id }); onClose(); }}
                  style={{ flex: 2, fontSize: 12, padding: "6px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}
                >
                  Aceptar oferta →
                </button>
              </div>
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

// ── Modal: Pago en escrow ──────────────────────────────────────────────────────

function ModalPago({ sel, onClose, onPagado }: {
  sel: OfertaSeleccionada;
  onClose: () => void;
  onPagado: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"confirm" | "processing" | "done">("confirm");

  const handlePagar = async () => {
    setStep("processing");
    setLoading(true);
    // Simula proceso de pago (en prod: Stripe / MercadoPago)
    await new Promise((r) => setTimeout(r, 1800));
    setStep("done");
    setLoading(false);
  };

  return (
    <Modal title="Confirmar pago" onClose={onClose}>
      {step === "confirm" && (
        <>
          {/* Resumen */}
          <div style={{ background: "var(--color-background-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>Carga</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 12 }}>{sel.cargaTitulo}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Camionero</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{sel.oferta.nombre}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-brand-dark)" }}>${sel.oferta.precio.toLocaleString("es-AR")}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>ARS</div>
              </div>
            </div>
          </div>

          {/* Explicación escrow */}
          <div style={{ background: "#eff6ff", border: "0.5px solid #bfdbfe", borderRadius: "var(--border-radius-lg)", padding: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1d4ed8", marginBottom: 8 }}>ℹ ¿Cómo funciona el pago?</div>
            <div style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.6 }}>
              1. Vos pagás <strong>${sel.oferta.precio.toLocaleString("es-AR")}</strong> ahora. El dinero queda reservado en CargaBack.<br />
              2. El camionero inicia el viaje con la garantía de cobro.<br />
              3. Al confirmar la entrega, CargaBack libera el pago al camionero.<br />
              Si el viaje no se concreta, recibís el reembolso completo.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={handlePagar} style={{ flex: 2, fontSize: 13, padding: "10px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
              Pagar ${sel.oferta.precio.toLocaleString("es-AR")} →
            </button>
          </div>
        </>
      )}

      {step === "processing" && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>Procesando pago...</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>No cerrés esta ventana.</div>
        </div>
      )}

      {step === "done" && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 6 }}>¡Pago confirmado!</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 24 }}>
            ${sel.oferta.precio.toLocaleString("es-AR")} reservados. El camionero fue notificado.
          </div>
          <button
            onClick={onPagado}
            style={{ width: "100%", fontSize: 14, padding: "11px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}
          >
            Ir al chat con {sel.oferta.nombre} →
          </button>
        </div>
      )}
    </Modal>
  );
}

// ── Modal: Chat ───────────────────────────────────────────────────────────────

interface MensajeChat { id: string; emisor: "yo" | "otro"; texto: string; hora: string; }

function ModalChat({ sel, onClose }: { sel: OfertaSeleccionada; onClose: () => void }) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([
    { id: "1", emisor: "otro", texto: `Hola! Vi que aceptaste mi oferta para ${sel.cargaTitulo.split("—")[1]?.trim() ?? sel.cargaTitulo}. ¿Me confirmás la dirección exacta de carga?`, hora: "Ahora" },
  ]);
  const [texto, setTexto] = useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  const enviar = () => {
    if (!texto.trim()) return;
    const nuevo: MensajeChat = { id: Date.now().toString(), emisor: "yo", texto: texto.trim(), hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) };
    setMensajes((prev) => [...prev, nuevo]);
    setTexto("");
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
  };

  return (
    <Modal title={`Chat con ${sel.oferta.nombre}`} onClose={onClose}>
      {/* Info viaje */}
      <div style={{ background: "var(--color-brand-light)", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "var(--color-brand-dark)", fontWeight: 500 }}>
        🚛 {sel.cargaTitulo} · ${sel.oferta.precio.toLocaleString("es-AR")} · Pago en escrow
      </div>

      {/* Lista mensajes */}
      <div ref={listRef} style={{ height: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 14, paddingRight: 4 }}>
        {mensajes.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.emisor === "yo" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "75%", padding: "9px 13px", borderRadius: m.emisor === "yo" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              background: m.emisor === "yo" ? "var(--color-brand)" : "var(--color-background-secondary)",
              color: m.emisor === "yo" ? "#fff" : "var(--color-text-primary)",
              fontSize: 13, lineHeight: 1.5,
            }}>
              {m.texto}
              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: "right" }}>{m.hora}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="Escribí un mensaje..."
          style={{ flex: 1, fontSize: 13, padding: "9px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" }}
        />
        <button onClick={enviar} style={{ padding: "9px 16px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
          →
        </button>
      </div>
    </Modal>
  );
}

// ── Secciones ─────────────────────────────────────────────────────────────────

function SeccionMisCargas({
  cargas,
  loading,
  onVerOfertas,
  onDestacado,
}: {
  cargas: Carga[];
  loading: boolean;
  onVerOfertas: (c: Carga) => void;
  onDestacado: (titulo: string) => void;
}) {
  const [tab, setTab] = useState<TabItem>("Todas");

  const cargasFiltradas = tab === "Con ofertas" ? cargas.filter((c) => c.ofertas > 0)
    : tab === "Sin ofertas" ? cargas.filter((c) => c.ofertas === 0)
    : cargas;

  const activas = cargas.filter((c) => c.ofertas === 0).length;
  const conOfertas = cargas.filter((c) => c.ofertas > 0).length;

  const metricas = [
    { label: "Cargas activas",     valor: String(cargas.length),   sub: "Publicadas" },
    { label: "Con ofertas",        valor: String(conOfertas),       sub: "Esperando decisión" },
    { label: "Sin ofertas",        valor: String(activas),          sub: "Buscando camionero" },
    { label: "Completados",        valor: "38",                     sub: "Último mes" },
  ];

  return (
    <main style={{ padding: 20, flex: 1 }}>
      {/* Métricas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 24 }}>
        {metricas.map((m) => (
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
      </div>

      {/* Cards */}
      {loading && <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
      {!loading && cargasFiltradas.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
          No tenés cargas publicadas. Usá el botón &ldquo;+ Publicar carga&rdquo; para comenzar.
        </div>
      )}
      {!loading && cargasFiltradas.map((c) => {
        const partes = c.titulo.split(" — ");
        const tipoCarga = partes[0];
        const ruta = partes[1] ?? c.titulo;
        const [origen, destino] = ruta.split(" → ");
        return (
          <div key={c.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderLeft: "4px solid var(--color-brand)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10 }}>
            {/* Ruta — lo principal */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)" }}>{origen}</span>
                  <span style={{ fontSize: 18, color: "var(--color-brand)", fontWeight: 700 }}>→</span>
                  <span style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)" }}>{destino}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{tipoCarga} · {c.hace}</div>
              </div>
              <BadgeOfertas n={c.ofertas} />
            </div>

            {/* Detalles secundarios */}
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
                style={{ fontSize: 13, padding: "7px 16px", borderRadius: "var(--border-radius-md)", border: "none", background: c.ofertas > 0 ? "var(--color-brand)" : "transparent", color: c.ofertas > 0 ? "#fff" : "var(--color-text-primary)", border2: c.ofertas > 0 ? "none" : "0.5px solid var(--color-border-secondary)", cursor: "pointer", fontWeight: c.ofertas > 0 ? 600 : 400 } as React.CSSProperties}
              >
                {c.ofertas > 0 ? "Ver ofertas →" : "Destacar carga →"}
              </button>
            </div>
          </div>
        );
      })}
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

// ── Sección Perfil ────────────────────────────────────────────────────────────

function SeccionPerfil({ onToast, userName, userEmail }: { onToast: (m: string) => void; userName: string; userEmail: string }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(userName);
  const [telefono, setTelefono] = useState("+54 9 11 5555-1234");
  const initials = nombre.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";

  return (
    <main style={{ padding: 20, flex: 1, maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>Mi perfil</div>
        <button
          onClick={() => { if (editando) onToast("Perfil actualizado."); setEditando(!editando); }}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: editando ? "var(--color-brand)" : "transparent", color: editando ? "#fff" : "var(--color-text-primary)", cursor: "pointer", fontWeight: editando ? 500 : 400 }}
        >
          {editando ? "Guardar cambios" : "Editar"}
        </button>
      </div>

      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "var(--color-brand-dark)" }}>{initials}</div>
          <div>
            {editando
              ? <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ fontSize: 18, fontWeight: 600, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", padding: "4px 8px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" }} />
              : <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-primary)" }}>{nombre}</div>
            }
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
              Dador de carga
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--color-brand-light)", color: "var(--color-brand-dark)", fontWeight: 500 }}>Verificado ✓</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 4 }}>{userEmail}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 14 }}>
          {[["Cargas publicadas", "38"], ["En tránsito", "2"], ["En plataforma desde", "Ene 2025"]].map(([label, val]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-primary)" }}>{val}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20, marginBottom: 12 }}>
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
            <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{userEmail || "—"}</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        style={{ marginTop: 8, fontSize: 13, padding: "8px 16px", borderRadius: "var(--border-radius-md)", border: "0.5px solid #fecaca", background: "#fef2f2", color: "#b91c1c", cursor: "pointer" }}
      >
        Cerrar sesión
      </button>
    </main>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function DadorDashboard() {
  const { data: session } = useSession();
  const [navActivo, setNavActivo] = useState<NavItem>("Mis cargas");
  const [modalPublicar, setModalPublicar] = useState(false);
  const [modalOfertas, setModalOfertas] = useState<Carga | null>(null);
  const [modalPago, setModalPago] = useState<OfertaSeleccionada | null>(null);
  const [modalChat, setModalChat] = useState<OfertaSeleccionada | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [loadingCargas, setLoadingCargas] = useState(true);

  const userName = session?.user?.name ?? "Usuario";
  const userEmail = session?.user?.email ?? "";
  const initials = userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
  const primerNombre = userName.split(" ")[0];

  const mostrarToast = (msg: string) => setToast(msg);

  const fetchCargas = React.useCallback(async () => {
    setLoadingCargas(true);
    try {
      const res = await fetch("/api/loads");
      if (res.ok) {
        const data = await res.json();
        setCargas((data.loads ?? []).map(loadToCard));
      }
    } finally {
      setLoadingCargas(false);
    }
  }, []);

  useEffect(() => { fetchCargas(); }, [fetchCargas]);

  return (
    <div style={{ background: "var(--color-background-primary)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Topbar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 58, background: "#16301a", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Link href="/" style={{ fontSize: 18, fontWeight: 700, color: "#fff", textDecoration: "none", letterSpacing: "-0.01em" }}>
            Carga<span style={{ color: "var(--color-brand)" }}>Back</span>
          </Link>
          <nav style={{ display: "flex", gap: 2 }}>
            {(["Mis cargas", "Historial", "Camioneros", "Facturación"] as NavItem[]).map((item) => (
              <button key={item} onClick={() => setNavActivo(item)} style={{
                fontSize: 15, padding: "8px 14px", borderRadius: "var(--border-radius-md)",
                border: "none", cursor: "pointer",
                background: navActivo === item ? "rgba(255,255,255,0.12)" : "transparent",
                color: navActivo === item ? "#fff" : "rgba(255,255,255,0.6)",
                fontWeight: navActivo === item ? 600 : 400,
              }}>
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setModalPublicar(true)} style={{ fontSize: 13, padding: "7px 14px", borderRadius: "var(--border-radius-md)", background: "var(--color-brand)", border: "none", color: "#fff", fontWeight: 500, cursor: "pointer" }}>
            + Publicar carga
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{primerNombre}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Dador de carga</span>
            </div>
            <button
              onClick={() => setNavActivo("Mi perfil")}
              title="Ver mi perfil"
              style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-brand)", border: "2px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}
            >
              {initials}
            </button>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--color-background-tertiary)" }}>
        {navActivo === "Mis cargas" && (
          <SeccionMisCargas
            cargas={cargas}
            loading={loadingCargas}
            onVerOfertas={(c) => setModalOfertas(c)}
            onDestacado={(titulo) => mostrarToast(`Carga "${titulo.split("—")[0].trim()}" destacada. Más camioneros la verán primero.`)}
          />
        )}
        {navActivo === "Historial" && <SeccionHistorial />}
        {navActivo === "Camioneros" && <SeccionCamioneros onToast={mostrarToast} />}
        {navActivo === "Facturación" && <SeccionFacturacion />}
        {navActivo === "Mi perfil" && <SeccionPerfil onToast={mostrarToast} userName={userName} userEmail={userEmail} />}
      </div>

      {/* Modales */}
      {modalPublicar && (
        <ModalPublicar
          onClose={() => setModalPublicar(false)}
          onPublicar={(nueva) => { setCargas((prev) => [nueva, ...prev]); mostrarToast("¡Carga publicada! Los camioneros ya pueden verla."); }}
        />
      )}
      {modalOfertas && (
        <ModalVerOfertas
          carga={modalOfertas}
          onClose={() => setModalOfertas(null)}
          onRechazar={(nombre) => mostrarToast(`Oferta de ${nombre} rechazada.`)}
          onIniciarPago={(sel) => { setModalOfertas(null); setModalPago(sel); }}
        />
      )}
      {modalPago && (
        <ModalPago
          sel={modalPago}
          onClose={() => setModalPago(null)}
          onPagado={() => { const sel = modalPago; setModalPago(null); setModalChat(sel); }}
        />
      )}
      {modalChat && (
        <ModalChat
          sel={modalChat}
          onClose={() => { setModalChat(null); mostrarToast("Viaje confirmado. ¡Éxito con el envío!"); fetchCargas(); }}
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
