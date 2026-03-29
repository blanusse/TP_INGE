"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

// ── Datos ────────────────────────────────────────────────────────────────────


// ── Tipos ────────────────────────────────────────────────────────────────────

type NavItem = "Mis cargas" | "Historial" | "Facturación" | "Mi perfil";
type TabItem = "Todas" | "Con ofertas" | "Sin ofertas" | "Confirmadas" | "En tránsito";

interface Oferta { id: number; offerId: string; nombre: string; iniciales: string; rating: number; viajes: number; precio: number; counterPrice?: number | null; status?: string; nota: string; }
interface AcceptedOffer { offerId: string; driverName: string; precio: number; }
interface Carga { id: string; titulo: string; hace: string; peso: string; tipoCamion: string; retiro: string; ofertas: number; camioneros: string[]; ofertasDetalle: Oferta[]; status: string; acceptedOffer: AcceptedOffer | null; }

interface LoadDB {
  _id: string;
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
  offers_count?: number;
  accepted_offer?: AcceptedOffer | null;
}

const TRUCK_LABEL: Record<string, string> = {
  camion:      "Furgón cerrado",
  semi:        "Plataforma",
  frigorifico: "Refrigerado",
  cisterna:    "Cisterna",
  acoplado:    "Acoplado",
  otros:       "Otros",
};

function loadToCard(load: LoadDB): Carga {
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
    id:           load._id,
    titulo,
    hace,
    peso:         load.weight_kg ? `${load.weight_kg.toLocaleString("es-AR")} kg` : "—",
    tipoCamion:   load.truck_type_required ? (TRUCK_LABEL[load.truck_type_required] ?? load.truck_type_required) : "Cualquiera",
    retiro:       load.ready_at ? new Date(load.ready_at).toLocaleDateString("es-AR") : "—",
    ofertas:      load.offers_count ?? 0,
    camioneros:   [],
    ofertasDetalle: [],
    status:       load.status,
    acceptedOffer: load.accepted_offer ?? null,
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

interface GeoResult { label: string; zone: string; full: string; lat: number; lon: number; }

function InputUbicacion({
  value,
  onChange,
  onSelect,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (r: GeoResult) => void;
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
    onSelect?.(r);
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

interface PriceEstimate { distanceKm: number; minPrice: number; suggestedPrice: number; maxPrice: number; }

interface UbicacionMeta { zone: string; lat: number; lon: number; }

function ModalPublicar({ onClose, onPublicar }: { onClose: () => void; onPublicar: (c: Carga) => void }) {
  const [form, setForm] = useState({ origen: "", destino: "", tipoCarga: "General", tipoCamion: "Cualquiera", peso: "", precio: "", retiro: "", descripcion: "" });
  const [origenMeta,  setOrigenMeta]  = useState<UbicacionMeta | null>(null);
  const [destinoMeta, setDestinoMeta] = useState<UbicacionMeta | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [estimate, setEstimate]     = useState<PriceEstimate | null>(null);
  const [loadingEst, setLoadingEst] = useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Recalcular estimado cuando cambian origen, destino o tipo de carga
  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (form.origen.length < 3 || form.destino.length < 3) { setEstimate(null); return; }
    timerRef.current = setTimeout(async () => {
      setLoadingEst(true);
      try {
        const params = new URLSearchParams({ origen: form.origen, destino: form.destino, tipoCarga: form.tipoCarga });
        const res  = await fetch(`/api/estimate-price?${params}`);
        const data = await res.json();
        if (res.ok) setEstimate(data);
        else setEstimate(null);
      } catch {
        setEstimate(null);
      } finally {
        setLoadingEst(false);
      }
    }, 700);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [form.origen, form.destino, form.tipoCarga]);

  const precioNum  = parseInt(form.precio) || 0;
  const bajoMinimo = estimate && precioNum > 0 && precioNum < estimate.minPrice;
  const sobreMax   = estimate && precioNum > 0 && precioNum > estimate.maxPrice * 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // Zona aproximada (barrio/ciudad) — visible a todos los camioneros
          origenZona:  origenMeta?.zone  ?? undefined,
          destinoZona: destinoMeta?.zone ?? undefined,
          // Coordenadas para calcular distancias
          origenLat:   origenMeta?.lat   ?? undefined,
          origenLon:   origenMeta?.lon   ?? undefined,
          destinoLat:  destinoMeta?.lat  ?? undefined,
          destinoLon:  destinoMeta?.lon  ?? undefined,
        }),
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
              onChange={(v) => { set("origen", v); setOrigenMeta(null); }}
              onSelect={(r) => { set("origen", r.label); setOrigenMeta({ zone: r.zone, lat: r.lat, lon: r.lon }); }}
              placeholder="Dirección exacta de retiro"
            />
            {origenMeta && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 3 }}>📍 Zona visible a camioneros: <strong>{origenMeta.zone}</strong></div>}
          </div>
          <div>
            <label style={labelStyle}>Destino *</label>
            <InputUbicacion
              id="destino"
              value={form.destino}
              onChange={(v) => { set("destino", v); setDestinoMeta(null); }}
              onSelect={(r) => { set("destino", r.label); setDestinoMeta({ zone: r.zone, lat: r.lat, lon: r.lon }); }}
              placeholder="Dirección exacta de entrega"
            />
            {destinoMeta && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 3 }}>📍 Zona visible a camioneros: <strong>{destinoMeta.zone}</strong></div>}
          </div>
        </div>

        {/* Estimado de distancia y precio */}
        {(loadingEst || estimate) && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: "var(--border-radius-md)", fontSize: 12 }}>
            {loadingEst ? (
              <span style={{ color: "var(--color-text-tertiary)" }}>Calculando distancia y precio de referencia...</span>
            ) : estimate && (
              <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <span style={{ color: "#15803d", fontWeight: 600 }}>📍 {estimate.distanceKm.toLocaleString("es-AR")} km</span>
                  <span style={{ color: "var(--color-text-tertiary)", marginLeft: 6 }}>en línea recta</span>
                </div>
                <div style={{ color: "#15803d" }}>
                  Precio de mercado: <strong>${estimate.minPrice.toLocaleString("es-AR")}</strong> — <strong>${estimate.maxPrice.toLocaleString("es-AR")}</strong>
                </div>
                <div style={{ color: "#15803d", fontWeight: 600 }}>
                  Sugerido: ${estimate.suggestedPrice.toLocaleString("es-AR")}
                  <button
                    type="button"
                    onClick={() => set("precio", String(estimate.suggestedPrice))}
                    style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 20, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer" }}
                  >
                    Usar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
            <input
              required type="number" value={form.precio}
              onChange={(e) => set("precio", e.target.value)}
              placeholder={estimate ? `Sugerido: $${estimate.suggestedPrice.toLocaleString("es-AR")}` : "ej: 280000"}
              style={{ ...inputStyle, borderColor: bajoMinimo ? "#ef4444" : sobreMax ? "#f59e0b" : undefined }}
            />
            {bajoMinimo && estimate && (
              <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 4 }}>
                ⚠ Mínimo para esta ruta: ${estimate.minPrice.toLocaleString("es-AR")}. Los camioneros no aceptarán menos.
              </div>
            )}
            {sobreMax && estimate && (
              <div style={{ fontSize: 11, color: "#92400e", marginTop: 4 }}>
                El precio está muy por encima del rango de mercado.
              </div>
            )}
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

interface OfertaSeleccionada { oferta: Oferta; cargaTitulo: string; cargaId: string; offerId: string; }

function ModalVerOfertas({ carga, onClose, onRechazar, onIniciarPago }: {
  carga: Carga;
  onClose: () => void;
  onRechazar: (nombre: string) => void;
  onIniciarPago: (sel: OfertaSeleccionada) => void;
}) {
  const [ofertas, setOfertas]       = useState<Oferta[]>([]);
  const [loadingOfertas, setLoading] = useState(true);
  const [accionando, setAccionando]  = useState<string | null>(null);
  const [confirmRechazar, setConfirmRechazar] = useState<Oferta | null>(null);
  const [contraofertaId, setContraofertaId]   = useState<string | null>(null);
  const [contraPrice, setContraPrice]         = useState("");

  React.useEffect(() => {
    fetch(`/api/offers?loadId=${carga.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.offers) setOfertas(d.offers); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [carga.id]);

  const callPatch = async (offerId: string, body: object) => {
    setAccionando(offerId);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.ok;
    } finally {
      setAccionando(null);
    }
  };

  const rechazar = async (o: Oferta) => {
    const ok = await callPatch(o.offerId, { action: "reject" });
    if (ok) { setOfertas((prev) => prev.filter((x) => x.offerId !== o.offerId)); onRechazar(o.nombre); }
    setConfirmRechazar(null);
  };

  const contraofertar = async (o: Oferta) => {
    if (!contraPrice || isNaN(Number(contraPrice))) return;
    const ok = await callPatch(o.offerId, { action: "counter", counterPrice: Number(contraPrice) });
    if (ok) {
      setOfertas((prev) => prev.map((x) => x.offerId === o.offerId ? { ...x, status: "countered", counterPrice: Number(contraPrice) } : x));
      setContraofertaId(null);
      setContraPrice("");
    }
  };

  // Modal de confirmación de rechazo
  if (confirmRechazar) {
    return (
      <Modal title="¿Rechazar esta oferta?" onClose={() => setConfirmRechazar(null)}>
        <div style={{ background: "#fff7ed", border: "0.5px solid #fed7aa", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#c2410c", marginBottom: 8 }}>⚠ Atención</div>
          <div style={{ fontSize: 13, color: "#9a3412", lineHeight: 1.6 }}>
            Si rechazás la oferta de <strong>{confirmRechazar.nombre}</strong>, este camionero <strong>no podrá volver a ofertar</strong> para esta carga.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setConfirmRechazar(null)} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={() => rechazar(confirmRechazar)} disabled={accionando === confirmRechazar.offerId} style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "none", background: "#b91c1c", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
            {accionando === confirmRechazar.offerId ? "Rechazando..." : "Sí, rechazar →"}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Ofertas para: ${carga.titulo}`} onClose={onClose}>
      {loadingOfertas && <div style={{ textAlign: "center", padding: 24, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando ofertas...</div>}
      {!loadingOfertas && ofertas.length === 0 && (
        <div style={{ textAlign: "center", padding: 24, color: "var(--color-text-tertiary)", fontSize: 14 }}>Sin ofertas todavía.</div>
      )}
      {!loadingOfertas && ofertas.map((o) => {
        const esContraoferta = o.status === "countered";
        return (
          <div key={o.offerId} style={{
            border: `0.5px solid ${esContraoferta ? "#bfdbfe" : "var(--color-border-tertiary)"}`,
            borderRadius: "var(--border-radius-md)", padding: 14, marginBottom: 10,
            background: esContraoferta ? "#eff6ff" : "var(--color-background-primary)",
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
                {esContraoferta && o.counterPrice && (
                  <div style={{ fontSize: 11, color: "#1d4ed8" }}>Tu contraoferta: ${o.counterPrice.toLocaleString("es-AR")}</div>
                )}
              </div>
            </div>
            {o.nota && (
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "6px 10px", background: "var(--color-background-tertiary)", borderRadius: "var(--border-radius-md)", marginBottom: 10 }}>
                &ldquo;{o.nota}&rdquo;
              </div>
            )}
            {esContraoferta ? (
              <div style={{ fontSize: 12, color: "#1d4ed8", padding: "8px 10px", background: "#dbeafe", borderRadius: "var(--border-radius-md)" }}>
                Contraoferta enviada — esperando respuesta del camionero
              </div>
            ) : contraofertaId === o.offerId ? (
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input
                  type="number"
                  value={contraPrice}
                  onChange={(e) => setContraPrice(e.target.value)}
                  placeholder="Tu precio (ARS)"
                  style={{ flex: 1, fontSize: 13, padding: "6px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)" }}
                />
                <button onClick={() => { setContraofertaId(null); setContraPrice(""); }} style={{ fontSize: 12, padding: "6px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>✕</button>
                <button onClick={() => contraofertar(o)} disabled={accionando === o.offerId} style={{ fontSize: 12, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "none", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Enviar</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => setConfirmRechazar(o)} style={{ flex: 1, fontSize: 12, padding: "6px", borderRadius: "var(--border-radius-md)", border: "0.5px solid #fecaca", background: "#fef2f2", color: "#b91c1c", cursor: "pointer", minWidth: 80 }}>
                  Rechazar
                </button>
                <button onClick={() => { setContraofertaId(o.offerId); setContraPrice(String(o.precio)); }} style={{ flex: 1, fontSize: 12, padding: "6px", borderRadius: "var(--border-radius-md)", border: "0.5px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", cursor: "pointer", minWidth: 80 }}>
                  Contraofertar
                </button>
                <button
                  onClick={() => { onIniciarPago({ oferta: o, cargaTitulo: carga.titulo, cargaId: carga.id, offerId: o.offerId }); onClose(); }}
                  style={{ flex: 2, fontSize: 12, padding: "6px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600, minWidth: 100 }}
                >
                  Aceptar →
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

// ── Modal: Pago con MercadoPago ───────────────────────────────────────────────

function ModalPago({ sel, onClose, onPagado }: {
  sel: OfertaSeleccionada;
  onClose: () => void;
  onPagado: (sel: OfertaSeleccionada) => void;
}) {
  const [estado, setEstado] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [error, setError]   = useState<string | null>(null);

  const handleSimular = async () => {
    setEstado("processing");
    setError(null);
    // Simular delay de procesamiento
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch("/api/payments/simulate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ offerId: sel.offerId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al procesar el pago."); setEstado("error"); return; }
      setEstado("done");
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
      setEstado("error");
    }
  };

  if (estado === "processing") {
    return (
      <Modal title="Procesando pago" onClose={onClose}>
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>
            <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8 }}>Procesando pago...</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Por favor esperá un momento.</div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </Modal>
    );
  }

  if (estado === "done") {
    return (
      <Modal title="Pago confirmado" onClose={() => onPagado(sel)}>
        <div style={{ textAlign: "center", padding: "32px 20px" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#f0fdf4", border: "2px solid #16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 20px" }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", marginBottom: 8 }}>¡Pago confirmado!</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6 }}>
            El viaje fue confirmado con <strong>{sel.oferta.nombre}</strong>.
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 24 }}>
            ${sel.oferta.precio.toLocaleString("es-AR")} ARS
          </div>
          <div style={{ background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: "var(--border-radius-md)", padding: "12px 16px", marginBottom: 24, fontSize: 12, color: "#15803d", lineHeight: 1.6, textAlign: "left" }}>
            El dinero queda retenido hasta confirmar la entrega. El camionero recibe el pago cuando se complete el viaje.
          </div>
          <button
            onClick={() => onPagado(sel)}
            style={{ width: "100%", fontSize: 14, padding: "12px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            Abrir chat con el camionero →
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Confirmar pago" onClose={onClose}>
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

      {/* Info pago simulado */}
      <div style={{ background: "#fffbeb", border: "0.5px solid #fde68a", borderRadius: "var(--border-radius-lg)", padding: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 6 }}>Pago simulado</div>
        <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.6 }}>
          Al confirmar, el viaje quedará en estado <strong>En tránsito</strong> y se habilitará el chat con el camionero.
          En producción, este paso se realiza con Mercado Pago.
        </div>
      </div>

      {estado === "error" && error && (
        <div style={{ background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: "var(--border-radius-md)", padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#b91c1c" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
          Cancelar
        </button>
        <button
          onClick={handleSimular}
          style={{ flex: 2, fontSize: 13, padding: "10px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 700 }}
        >
          Confirmar y pagar
        </button>
      </div>
    </Modal>
  );
}

// ── Modal: Calificar camionero ────────────────────────────────────────────────

function ModalCalificarCamionero({ offerId, driverName, onClose }: { offerId: string; driverName: string; onClose: () => void }) {
  const [score, setScore]       = useState(0);
  const [hover, setHover]       = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [done, setDone]         = useState(false);

  const enviar = async () => {
    if (!score) return;
    setEnviando(true);
    try {
      await fetch("/api/ratings", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ offerId, score }),
      });
      setDone(true);
    } finally {
      setEnviando(false);
    }
  };

  if (done) {
    return (
      <Modal title="¡Gracias por calificar!" onClose={onClose}>
        <div style={{ textAlign: "center", padding: "28px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>Calificación enviada</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>Tu opinión ayuda a la comunidad de CargaBack.</div>
          <button onClick={onClose} style={{ fontSize: 14, padding: "10px 28px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Calificá a ${driverName}`} onClose={onClose}>
      <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>
          ¿Cómo fue tu experiencia con este camionero?
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setScore(s)}
              style={{ fontSize: 36, background: "none", border: "none", cursor: "pointer", color: s <= (hover || score) ? "#BA7517" : "var(--color-border-secondary)", transition: "color 0.1s", padding: "0 2px" }}
            >★</button>
          ))}
        </div>
        {score > 0 && (
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>
            {["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"][score]}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
            Omitir
          </button>
          <button onClick={enviar} disabled={!score || enviando} style={{ flex: 2, fontSize: 13, padding: "10px", borderRadius: "var(--border-radius-md)", border: "none", background: score ? "var(--color-brand)" : "var(--color-background-secondary)", color: score ? "#fff" : "var(--color-text-tertiary)", cursor: score ? "pointer" : "not-allowed", fontWeight: 600 }}>
            {enviando ? "Enviando..." : "Enviar calificación"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Chat (reutilizable como inline o modal) ───────────────────────────────────

interface MensajeChat { id: string; senderId: string; texto: string; hora: string; }

function ChatInline({ sel, userId }: { sel: OfertaSeleccionada; userId: string }) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto]       = useState("");
  const [enviando, setEnviando] = useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetch(`/api/messages?offerId=${sel.offerId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.messages) {
          setMensajes(d.messages.map((m: { id: string; senderId: string; content: string; hora: string }) => ({
            id: m.id, senderId: m.senderId, texto: m.content, hora: m.hora,
          })));
          setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50);
        }
      })
      .catch(() => {});
  }, [sel.offerId]);

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: sel.offerId, content: texto.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        const m = data.message;
        setMensajes((prev) => [...prev, { id: m.id, senderId: m.senderId, texto: m.content, hora: m.hora }]);
        setTexto("");
        setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <div style={{ background: "var(--color-brand-light)", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "var(--color-brand-dark)", fontWeight: 500 }}>
        🚛 {sel.cargaTitulo} · ${sel.oferta.precio.toLocaleString("es-AR")} · Pago en escrow
      </div>
      <div ref={listRef} style={{ height: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 14, paddingRight: 4 }}>
        {mensajes.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13, marginTop: 80 }}>Sin mensajes todavía. ¡Iniciá la conversación!</div>
        )}
        {mensajes.map((m) => {
          const esYo = m.senderId === userId;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: esYo ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "75%", padding: "9px 13px", borderRadius: esYo ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: esYo ? "var(--color-brand)" : "var(--color-background-secondary)",
                color: esYo ? "#fff" : "var(--color-text-primary)",
                fontSize: 13, lineHeight: 1.5,
              }}>
                {m.texto}
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: "right" }}>{m.hora}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="Escribí un mensaje..."
          style={{ flex: 1, fontSize: 13, padding: "9px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" }}
        />
        <button onClick={enviar} disabled={enviando} style={{ padding: "9px 16px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: enviando ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14, opacity: enviando ? 0.7 : 1 }}>→</button>
      </div>
    </div>
  );
}

function ModalChat({ sel, onClose, userId }: { sel: OfertaSeleccionada; onClose: () => void; userId: string }) {
  return (
    <Modal title={`Chat con ${sel.oferta.nombre}`} onClose={onClose}>
      <ChatInline sel={sel} userId={userId} />
    </Modal>
  );
}

// ── Secciones ─────────────────────────────────────────────────────────────────

function SeccionMisCargas({
  cargas,
  loading,
  onVerOfertas,
  onDestacado,
  onIniciarPago,
  onRefresh,
}: {
  cargas: Carga[];
  loading: boolean;
  onVerOfertas: (c: Carga) => void;
  onDestacado: (titulo: string) => void;
  onIniciarPago: (sel: OfertaSeleccionada) => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<TabItem>("Todas");
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [modalCalificar, setModalCalificar] = useState<{ offerId: string; driverName: string } | null>(null);

  const publicadas  = cargas.filter((c) => c.status !== "matched" && c.status !== "in_transit" && c.status !== "delivered");
  const matched     = cargas.filter((c) => c.status === "matched");
  const enTransito  = cargas.filter((c) => c.status === "in_transit");

  const cargasBase = tab === "Con ofertas" ? publicadas.filter((c) => c.ofertas > 0)
    : tab === "Sin ofertas" ? publicadas.filter((c) => c.ofertas === 0)
    : tab === "Confirmadas" ? matched
    : tab === "En tránsito" ? enTransito
    : publicadas;

  const tabCards = [
    { t: "Todas"       as TabItem, icon: "📦", color: "var(--color-brand)", bg: "var(--color-brand-light)", count: publicadas.length,                             desc: "Buscando camionero" },
    { t: "Con ofertas" as TabItem, icon: "📩", color: "#3b82f6",            bg: "#eff6ff",                  count: publicadas.filter((c) => c.ofertas > 0).length, desc: "Esperando tu decisión" },
    { t: "Sin ofertas" as TabItem, icon: "⏳", color: "#f59e0b",            bg: "#fffbeb",                  count: publicadas.filter((c) => c.ofertas === 0).length, desc: "Sin postulantes aún" },
    { t: "Confirmadas" as TabItem, icon: "✓",  color: "#16a34a",            bg: "#f0fdf4",                  count: matched.length,                                  desc: "Esperando pago" },
    { t: "En tránsito" as TabItem, icon: "🚛", color: "#8b5cf6",            bg: "#f5f3ff",                  count: enTransito.length,                               desc: "Viajes en curso" },
  ];

  const confirmarLlegada = async (c: Carga) => {
    setConfirmando(c.id);
    try {
      const res  = await fetch(`/api/loads/${c.id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.offerId) {
        onRefresh();
        const driverName = c.acceptedOffer?.driverName ?? "el camionero";
        setModalCalificar({ offerId: data.offerId, driverName });
      }
    } finally {
      setConfirmando(null);
    }
  };

  const CargaCard = ({ c }: { c: Carga }) => {
    const partes = c.titulo.split(" — ");
    const tipoCarga = partes[0];
    const ruta = partes[1] ?? c.titulo;
    const [origen, destino] = ruta.split(" → ");
    return (
      <div key={c.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderLeft: `4px solid var(--color-brand)`, borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10 }}>
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
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {c.ofertas} {c.ofertas === 1 ? "camionero ofertó" : "camioneros ofertaron"}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Esperando camioneros...</span>
          )}
          <button
            onClick={() => c.ofertas > 0 ? onVerOfertas(c) : onDestacado(c.titulo)}
            style={{ fontSize: 13, padding: "7px 16px", borderRadius: "var(--border-radius-md)", border: c.ofertas > 0 ? "none" : "0.5px solid var(--color-border-secondary)", background: c.ofertas > 0 ? "var(--color-brand)" : "transparent", color: c.ofertas > 0 ? "#fff" : "var(--color-text-primary)", cursor: "pointer", fontWeight: c.ofertas > 0 ? 600 : 400 }}
          >
            {c.ofertas > 0 ? "Ver ofertas →" : "Destacar carga →"}
          </button>
        </div>
      </div>
    );
  };

  const MatchedCard = ({ c }: { c: Carga }) => {
    const ao = c.acceptedOffer;
    const partes = c.titulo.split(" — ");
    const tipoCarga = partes[0];
    const ruta = partes[1] ?? c.titulo;
    const [origen, destino] = ruta.split(" → ");
    return (
      <div style={{ background: "var(--color-background-primary)", border: "1.5px solid #16a34a", borderLeft: "4px solid #16a34a", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)" }}>{origen}</span>
              <span style={{ fontSize: 18, color: "#16a34a", fontWeight: 700 }}>→</span>
              <span style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)" }}>{destino}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{tipoCarga} · {c.hace}</div>
          </div>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: "#f0fdf4", color: "#16a34a" }}>Confirmado ✓</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
          {[["Peso", c.peso], ["Tipo de camión", c.tipoCamion], ["Fecha de retiro", c.retiro]].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{val}</div>
            </div>
          ))}
        </div>
        {ao && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, padding: "10px 14px", background: "#f0fdf4", borderRadius: "var(--border-radius-md)", border: "0.5px solid #bbf7d0" }}>
            <div>
              <div style={{ fontSize: 12, color: "#15803d", marginBottom: 2 }}>Camionero: <strong>{ao.driverName}</strong></div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#15803d" }}>${ao.precio.toLocaleString("es-AR")}</div>
            </div>
            <button
              onClick={() => onIniciarPago({ offerId: ao.offerId, cargaTitulo: c.titulo, cargaId: c.id, oferta: { nombre: ao.driverName, precio: ao.precio, offerId: ao.offerId, id: 0, iniciales: ao.driverName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2), rating: 0, viajes: 0, nota: "" } })}
              style={{ fontSize: 13, padding: "9px 20px", borderRadius: "var(--border-radius-md)", border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              Pagar →
            </button>
          </div>
        )}
      </div>
    );
  };

  const InTransitCard = ({ c }: { c: Carga }) => {
    const ao = c.acceptedOffer;
    const partes = c.titulo.split(" — ");
    const tipoCarga = partes[0];
    const ruta = partes[1] ?? c.titulo;
    const [origen, destino] = ruta.split(" → ");
    return (
      <div style={{ background: "var(--color-background-primary)", border: "1.5px solid #8b5cf6", borderLeft: "4px solid #8b5cf6", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)" }}>{origen}</span>
              <span style={{ fontSize: 18, color: "#8b5cf6", fontWeight: 700 }}>→</span>
              <span style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)" }}>{destino}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{tipoCarga} · {c.hace}</div>
          </div>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: "#f5f3ff", color: "#8b5cf6" }}>En tránsito 🚛</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
          {[["Peso", c.peso], ["Tipo de camión", c.tipoCamion], ["Fecha de retiro", c.retiro]].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{val}</div>
            </div>
          ))}
        </div>
        {ao && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, padding: "10px 14px", background: "#f5f3ff", borderRadius: "var(--border-radius-md)", border: "0.5px solid #ddd6fe" }}>
            <div>
              <div style={{ fontSize: 12, color: "#6d28d9", marginBottom: 2 }}>Camionero: <strong>{ao.driverName}</strong></div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#6d28d9" }}>${ao.precio.toLocaleString("es-AR")}</div>
            </div>
            <button
              onClick={() => confirmarLlegada(c)}
              disabled={confirmando === c.id}
              style={{ fontSize: 13, padding: "9px 20px", borderRadius: "var(--border-radius-md)", border: "none", background: confirmando === c.id ? "#aaa" : "#8b5cf6", color: "#fff", fontWeight: 700, cursor: confirmando === c.id ? "not-allowed" : "pointer" }}
            >
              {confirmando === c.id ? "Confirmando..." : "Confirmar llegada ✓"}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <main style={{ padding: "20px 24px", flex: 1 }}>
      {modalCalificar && (
        <ModalCalificarCamionero
          offerId={modalCalificar.offerId}
          driverName={modalCalificar.driverName}
          onClose={() => setModalCalificar(null)}
        />
      )}

      {/* Tab cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 24 }}>
        {tabCards.map(({ t, icon, color, bg, count, desc }) => (
          <button key={t} onClick={() => setTab(t)} style={{
            border: tab === t ? `2px solid ${color}` : "1.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            background: tab === t ? bg : "var(--color-background-primary)",
            padding: "14px 16px",
            cursor: "pointer",
            textAlign: "left" as const,
            transition: "all 0.15s",
            boxShadow: tab === t ? `0 2px 12px ${color}33` : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: "var(--border-radius-md)", background: tab === t ? color : "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, transition: "all 0.15s" }}>{icon}</div>
              <span style={{ fontSize: 26, fontWeight: 700, color: tab === t ? color : "var(--color-text-primary)", lineHeight: 1 }}>{count}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: tab === t ? color : "var(--color-text-primary)", marginBottom: 2 }}>{t}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{desc}</div>
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}

      {!loading && (
        <>
          {tab === "Confirmadas" ? (
            matched.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
                No tenés cargas con camionero confirmado todavía.
              </div>
            ) : (
              matched.map((c) => <MatchedCard key={c.id} c={c} />)
            )
          ) : tab === "En tránsito" ? (
            enTransito.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🚛</div>
                No tenés viajes en tránsito ahora.
              </div>
            ) : (
              enTransito.map((c) => <InTransitCard key={c.id} c={c} />)
            )
          ) : (
            cargasBase.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
                {tab === "Todas" ? "No tenés cargas publicadas. Usá el botón \u201C+ Publicar carga\u201D para comenzar." : `No hay cargas en la categoría "${tab}".`}
              </div>
            ) : (
              cargasBase.map((c) => <CargaCard key={c.id} c={c} />)
            )
          )}
        </>
      )}
    </main>
  );
}

function SeccionHistorial() {
  return (
    <main style={{ padding: 20, flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 16 }}>Historial de envíos</div>
      <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14, background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}>
        No tenés envíos completados todavía.
      </div>
    </main>
  );
}


interface Conversacion { offerId: string; cargaTitulo: string; otherUserName: string; precio: number; lastMessage: string | null; lastMessageTime: string | null; }

function SeccionMensajesDador({ userId }: { userId: string }) {
  const [convs, setConvs]         = useState<Conversacion[]>([]);
  const [loading, setLoading]     = useState(true);
  const [chatAbierto, setChatAbierto] = useState<Conversacion | null>(null);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => { if (d.conversations) setConvs(d.conversations); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (chatAbierto) {
    const sel: OfertaSeleccionada = {
      offerId: chatAbierto.offerId,
      cargaTitulo: chatAbierto.cargaTitulo,
      cargaId: "",
      oferta: { id: 0, offerId: chatAbierto.offerId, nombre: chatAbierto.otherUserName, iniciales: chatAbierto.otherUserName.slice(0, 2).toUpperCase(), rating: 0, viajes: 0, precio: chatAbierto.precio, nota: "" },
    };
    return (
      <main style={{ padding: "28px 32px", flex: 1, maxWidth: 760 }}>
        <button onClick={() => setChatAbierto(null)} style={{ fontSize: 13, color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer", marginBottom: 16, padding: 0 }}>← Volver a mensajes</button>
        <ChatInline sel={sel} userId={userId} />
      </main>
    );
  }

  return (
    <main style={{ padding: "28px 32px", flex: 1, maxWidth: 760 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 20 }}>Mensajes</div>
      {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
      {!loading && convs.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-text-tertiary)", fontSize: 14, background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✉</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>No tenés mensajes todavía</div>
          <div>Los chats aparecerán aquí una vez que aceptes una oferta.</div>
        </div>
      )}
      {!loading && convs.map((c) => (
        <div key={c.offerId} onClick={() => setChatAbierto(c)} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "var(--color-text-info)", flexShrink: 0 }}>{c.otherUserName.slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{c.otherUserName}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.cargaTitulo}</div>
            {c.lastMessage && <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.lastMessage}</div>}
          </div>
          {c.lastMessageTime && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", flexShrink: 0 }}>{c.lastMessageTime}</div>}
        </div>
      ))}
    </main>
  );
}

interface Factura { id: string; offerId: string; fecha: string; concepto: string; camionero: string; monto: number; estado: string; }

function descargarFactura(f: Factura) {
  const contenido = [
    "========================================",
    "         CARGABACK — COMPROBANTE",
    "========================================",
    `N° Factura : ${f.id}`,
    `Fecha      : ${f.fecha}`,
    `Concepto   : ${f.concepto}`,
    `Camionero  : ${f.camionero}`,
    `Monto      : $${f.monto.toLocaleString("es-AR")} ARS`,
    `Estado     : ${f.estado}`,
    "========================================",
  ].join("\n");
  const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${f.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function SeccionFacturacion() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => { if (d.invoices) setFacturas(d.invoices); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalMes = facturas.reduce((acc, f) => acc + f.monto, 0);

  const descargarTodas = () => facturas.forEach((f) => descargarFactura(f));

  return (
    <main style={{ padding: 20, flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>Facturación</div>
        {facturas.length > 0 && (
          <button onClick={descargarTodas} style={{ fontSize: 13, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
            ↓ Descargar todas
          </button>
        )}
      </div>

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            ["Total pagado", totalMes > 0 ? `$${totalMes.toLocaleString("es-AR")}` : "—"],
            ["Facturas emitidas", String(facturas.length)],
          ].map(([label, val]) => (
            <div key={label} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "var(--color-text-primary)" }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}

      {!loading && facturas.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14, background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}>
          No hay facturas todavía. Aparecerán aquí cuando confirmes el pago de un envío.
        </div>
      )}

      {!loading && facturas.length > 0 && (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 2fr 1.2fr 90px 52px", gap: 0, borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "10px 16px" }}>
            {["N°", "Fecha", "Concepto", "Monto", "Estado", ""].map((h) => (
              <div key={h} style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</div>
            ))}
          </div>
          {facturas.map((f, idx) => (
            <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 2fr 1.2fr 90px 52px", gap: 0, padding: "12px 16px", borderBottom: idx < facturas.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{f.id}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{f.fecha}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.concepto}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>${f.monto.toLocaleString("es-AR")}</div>
              <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, fontWeight: 500, background: "var(--color-brand-light)", color: "var(--color-brand-dark)" }}>{f.estado}</span>
              <button
                onClick={() => descargarFactura(f)}
                title="Descargar factura"
                style={{ fontSize: 14, padding: "4px 8px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}
              >↓</button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// ── Sección Perfil ────────────────────────────────────────────────────────────

interface DadorStats { totalCargas: number; enTransito: number; memberSince: string; calificacionPromedio: number | null; razonSocial: string | null; cuit: string | null; address: string | null; }

function SeccionPerfil({ onToast, userName, userEmail }: { onToast: (m: string) => void; userName: string; userEmail: string }) {
  const [editando, setEditando]   = useState(false);
  const [nombre, setNombre]       = useState(userName);
  const [telefono, setTelefono]   = useState("");
  const [stats, setStats]         = useState<DadorStats | null>(null);
  const initials = nombre.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";

  React.useEffect(() => {
    fetch("/api/stats/dador")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  return (
    <main style={{ padding: "24px 28px", flex: 1, maxWidth: 820 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)" }}>Mi perfil</div>
        <button
          onClick={() => { if (editando) onToast("Perfil actualizado."); setEditando(!editando); }}
          style={{ fontSize: 13, padding: "8px 18px", borderRadius: "var(--border-radius-md)", border: editando ? "none" : "0.5px solid var(--color-border-secondary)", background: editando ? "var(--color-brand)" : "transparent", color: editando ? "#fff" : "var(--color-text-primary)", cursor: "pointer", fontWeight: 500 }}
        >
          {editando ? "Guardar cambios" : "Editar perfil"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Tarjeta principal */}
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 24, gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--color-brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1 }}>
              {editando
                ? <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ fontSize: 20, fontWeight: 700, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", padding: "4px 10px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", marginBottom: 4, width: "100%", maxWidth: 320 }} />
                : <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 4 }}>{nombre}</div>
              }
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Dador de carga</span>
                <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: "var(--color-brand-light)", color: "var(--color-brand-dark)", fontWeight: 600 }}>Verificado ✓</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 4 }}>{userEmail}</div>
            </div>
          </div>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
            {[
              { label: "Cargas publicadas", val: stats ? String(stats.totalCargas) : "—" },
              { label: "En tránsito ahora", val: stats ? String(stats.enTransito) : "—" },
              { label: "Calificación promedio", val: stats?.calificacionPromedio != null ? `${stats.calificacionPromedio} ⭐` : "Sin calificaciones" },
              { label: "En plataforma desde", val: stats?.memberSince ?? "—" },
            ].map(({ label, val }, i) => (
              <div key={label} style={{ textAlign: "center", padding: "16px 8px", borderRight: i < 3 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: "var(--color-brand-dark)", marginBottom: 4 }}>{val}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Empresa */}
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>Datos de empresa</div>
          <div style={{ display: "grid", gap: 14 }}>
            {[
              { label: "Razón social", val: stats?.razonSocial ?? "—" },
              { label: "CUIT / CUIL",  val: stats?.cuit        ?? "—" },
              { label: "Dirección",    val: stats?.address     ?? "—" },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Contacto */}
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>Contacto</div>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>Email</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{userEmail || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>Teléfono</div>
              {editando
                ? <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: +54 9 11 1234-5678" style={{ fontSize: 13, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", padding: "6px 10px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", width: "100%" }} />
                : <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{telefono || "—"}</div>
              }
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        style={{ fontSize: 13, padding: "9px 18px", borderRadius: "var(--border-radius-md)", border: "0.5px solid #fecaca", background: "#fef2f2", color: "#b91c1c", cursor: "pointer", fontWeight: 500 }}
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

  const userName  = session?.user?.name  ?? "Usuario";
  const userEmail = session?.user?.email ?? "";
  const userId    = session?.user?.id    ?? "";
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
            {(["Mis cargas", "Historial", "Facturación"] as NavItem[]).map((item) => {
              const badge = item === "Mis cargas" ? cargas.reduce((s, c) => s + c.ofertas, 0) : 0;
              return (
                <button key={item} onClick={() => setNavActivo(item)} style={{
                  fontSize: 16, padding: "9px 16px", borderRadius: "var(--border-radius-md)",
                  border: "none", cursor: "pointer", position: "relative",
                  background: navActivo === item ? "rgba(255,255,255,0.14)" : "transparent",
                  color: navActivo === item ? "#fff" : "rgba(255,255,255,0.62)",
                  fontWeight: navActivo === item ? 600 : 400,
                  letterSpacing: navActivo === item ? "-0.01em" : "normal",
                }}>
                  {item}
                  {badge > 0 && (
                    <span style={{ position: "absolute", top: 5, right: 5, width: 16, height: 16, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </button>
              );
            })}
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
            onIniciarPago={(sel) => setModalPago(sel)}
            onRefresh={fetchCargas}
          />
        )}
        {navActivo === "Historial" && <SeccionHistorial />}
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
          onPagado={(sel) => { setModalPago(null); fetchCargas(); setModalChat(sel); }}
        />
      )}
      {modalChat && (
        <ModalChat
          sel={modalChat}
          userId={userId}
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
