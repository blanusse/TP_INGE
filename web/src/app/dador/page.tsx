"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const TripMap = dynamic(() => import("@/app/_components/TripMap"), { ssr: false });
import { signOut, useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faClockRotateLeft, faFileInvoiceDollar, faHouse, faTruckFast, faSun, faMoon } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

// ── Datos ────────────────────────────────────────────────────────────────────


// ── Tipos ────────────────────────────────────────────────────────────────────

type NavItem = "Inicio" | "Mis cargas" | "Mis envios" | "Historial" | "Facturación" | "Mi perfil";
type TabItem = "Todas" | "Con ofertas" | "Sin ofertas" | "Confirmadas" | "En tránsito";

interface Oferta { id: number; offerId: string; nombre: string; iniciales: string; rating: number; viajes: number; precio: number; counterPrice?: number | null; status?: string; nota: string; telefono?: string | null; email?: string | null; dni?: string | null; }
interface AcceptedOffer { offerId: string; driverName: string; precio: number; }
interface Carga { id: string; titulo: string; hace: string; peso: string; tipoCamion: string; retiro: string; ofertas: number; camioneros: string[]; ofertasDetalle: Oferta[]; status: string; acceptedOffer: AcceptedOffer | null; }

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
  offer_count?: number;
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
    id:           load.id,
    titulo,
    hace,
    peso:         load.weight_kg ? `${load.weight_kg.toLocaleString("es-AR")} kg` : "—",
    tipoCamion:   load.truck_type_required ? (TRUCK_LABEL[load.truck_type_required] ?? load.truck_type_required) : "Cualquiera",
    retiro:       load.ready_at ? new Date(load.ready_at).toLocaleDateString("es-AR") : "—",
    ofertas:      load.offer_count ?? 0,
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
      <i className="fa-solid fa-circle-check" /> {mensaje}
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
  confirmed,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (r: GeoResult) => void;
  placeholder: string;
  id: string;
  confirmed?: boolean;
}) {
  const [sugerencias, setSugerencias] = useState<GeoResult[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef   = React.useRef<AbortController | null>(null);
  const wrapRef    = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buscar = (q: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (q.length < 3) { setSugerencias([]); setAbierto(false); setFocusIndex(-1); return; }
    timeoutRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setCargando(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: abortRef.current.signal });
        const data = await res.json();
        setSugerencias(data.results ?? []);
        setFocusIndex(-1);
        setAbierto(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setSugerencias([]);
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
    setFocusIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!abierto || sugerencias.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, sugerencias.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusIndex >= 0) {
      e.preventDefault();
      seleccionar(sugerencias[focusIndex]);
    } else if (e.key === "Escape") {
      setAbierto(false);
      setFocusIndex(-1);
    }
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
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{ ...inputStyle, paddingRight: 52, border: confirmed ? "0.5px solid #16a34a" : inputStyle.border }}
        />
        {cargando && (
          <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--color-text-tertiary)" }}><i className="fa-solid fa-spinner fa-spin" /></div>
        )}
        {!cargando && confirmed && (
          <i className="fa-solid fa-circle-check" style={{ position: "absolute", right: 30, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#16a34a", pointerEvents: "none" }} />
        )}
        {!cargando && value && (
          <button
            type="button"
            onClick={() => { onChange(""); setSugerencias([]); setAbierto(false); setFocusIndex(-1); }}
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
              onMouseEnter={() => setFocusIndex(i)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 12px", border: "none",
                background: focusIndex === i ? "var(--color-background-secondary)" : "transparent",
                cursor: "pointer", textAlign: "left",
                borderBottom: i < sugerencias.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none",
              }}
            >
              <i className="fa-solid fa-location-dot" style={{ fontSize: 14, flexShrink: 0, color: "var(--color-text-tertiary)" }} />
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
  if (n === 0) return <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 500, background: "var(--badge-neutral-bg)", color: "var(--badge-neutral-text)" }}>Sin ofertas</span>;
  if (n === 1) return <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 500, background: "var(--color-brand-light)", color: "var(--color-brand-dark)" }}>1 oferta</span>;
  return <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 500, background: "var(--color-brand-light)", color: "var(--color-brand-dark)" }}>{n} ofertas</span>;
}

// ── Modal: Publicar carga ─────────────────────────────────────────────────────

interface PriceEstimate { distanceKm: number; minPrice: number; suggestedPrice: number; maxPrice: number; }

interface UbicacionMeta { zone: string; lat: number; lon: number; }

function ModalPublicar({ onClose, onPublicar }: { onClose: () => void; onPublicar: (c: Carga) => void }) {
  const [form, setForm] = useState({ origen: "", destino: "", tipoCarga: "General", tipoCamion: "Cualquiera", peso: "", precio: "", retiro: "" });
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
    if (!origenMeta || !destinoMeta) { setEstimate(null); return; }
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
  }, [origenMeta, destinoMeta, form.tipoCarga]);

  const precioNum  = parseInt(form.precio) || 0;
  const bajoMinimo = estimate && precioNum > 0 && precioNum < estimate.minPrice;
  const sobreMax   = estimate && precioNum > 0 && precioNum > estimate.maxPrice * 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origenMeta) { setError("El origen debe ser una dirección específica. Escribí y seleccioná una opción del listado."); return; }
    if (!destinoMeta) { setError("El destino debe ser una dirección específica. Escribí y seleccioná una opción del listado."); return; }
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
              confirmed={origenMeta !== null}
            />
            {origenMeta && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 3 }}><i className="fa-solid fa-location-dot" /> Zona visible a camioneros: <strong>{origenMeta.zone}</strong></div>}
          </div>
          <div>
            <label style={labelStyle}>Destino *</label>
            <InputUbicacion
              id="destino"
              value={form.destino}
              onChange={(v) => { set("destino", v); setDestinoMeta(null); }}
              onSelect={(r) => { set("destino", r.label); setDestinoMeta({ zone: r.zone, lat: r.lat, lon: r.lon }); }}
              placeholder="Dirección exacta de entrega"
              confirmed={destinoMeta !== null}
            />
            {destinoMeta && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 3 }}><i className="fa-solid fa-location-dot" /> Zona visible a camioneros: <strong>{destinoMeta.zone}</strong></div>}
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
                  <span style={{ color: "#15803d", fontWeight: 600 }}><i className="fa-solid fa-location-dot" /> {estimate.distanceKm.toLocaleString("es-AR")} km</span>
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
    const ok = await callPatch(o.offerId, { action: "counter", counter_price: Number(contraPrice) });
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

function ModalPago({ sel, onClose }: {
  sel: OfertaSeleccionada;
  onClose: () => void;
}) {
  const [estado, setEstado] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError]   = useState<string | null>(null);

  const handlePagar = async () => {
    setEstado("loading");
    setError(null);
    try {
      const res = await fetch("/api/payments/create-preference", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ offerId: sel.offerId, loadId: sel.cargaId, titulo: sel.cargaTitulo }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al crear el pago."); setEstado("error"); return; }
      // Redirigir al checkout de MercadoPago
      window.location.href = data.init_point;
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
      setEstado("error");
    }
  };

  if (estado === "loading") {
    return (
      <Modal title="Redirigiendo a MercadoPago" onClose={onClose}>
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>
            <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8 }}>Preparando el pago...</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Vas a ser redirigido a MercadoPago.</div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </Modal>
    );
  }

  return (
    <Modal title="Pagar con MercadoPago" onClose={onClose}>
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

      {/* Info MercadoPago */}
      <div style={{ background: "#f0f4ff", border: "0.5px solid #c7d7fd", borderRadius: "var(--border-radius-lg)", padding: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e3a8a", marginBottom: 6 }}>Pago seguro con MercadoPago</div>
        <div style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.6 }}>
          Serás redirigido al checkout oficial de MercadoPago. El pago se acredita al instante una vez confirmado.
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
          onClick={handlePagar}
          style={{ flex: 2, fontSize: 13, padding: "10px", borderRadius: "var(--border-radius-md)", border: "none", background: "#009ee3", color: "#fff", cursor: "pointer", fontWeight: 700 }}
        >
          Pagar con MercadoPago
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
        <i className="fa-solid fa-truck" /> {sel.cargaTitulo} · ${sel.oferta.precio.toLocaleString("es-AR")} · Pago en escrow
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
  onPublicar,
}: {
  cargas: Carga[];
  loading: boolean;
  onVerOfertas: (c: Carga) => void;
  onDestacado: (titulo: string) => void;
  onIniciarPago: (sel: OfertaSeleccionada) => void;
  onRefresh: () => void;
  onPublicar: () => void;
}) {
  type MisCargasTab = "Publicadas" | "Asignadas";
  const [tab, setTab] = useState<MisCargasTab>("Publicadas");
  const [detalleCarga, setDetalleCarga] = useState<Carga | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [deliveryCode, setDeliveryCode] = useState<{ code: string; used: boolean } | null>(null);

  const publicadas = cargas.filter((c) => c.status === "available");
  const asignadas = cargas.filter((c) => c.status === "matched" || c.status === "in_transit" || c.status === "accepted");

  const listado = tab === "Publicadas" ? publicadas : asignadas;

  const eliminarCarga = async (id: string) => {
    setEliminando(id);
    try {
      const res = await fetch(`/api/loads`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loadId: id }) });
      if (res.ok) onRefresh();
    } finally {
      setEliminando(null);
    }
  };

  // Cargar código de entrega cuando se abre el detalle de una carga pagada
  useEffect(() => {
    if (!detalleCarga) { setDeliveryCode(null); return; }
    const esAsignada = detalleCarga.status === "matched" || detalleCarga.status === "in_transit" || detalleCarga.status === "delivered";
    if (!esAsignada) { setDeliveryCode(null); return; }
    fetch(`/api/payments/delivery-code?loadId=${detalleCarga.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.delivery_code) setDeliveryCode({ code: d.delivery_code, used: d.delivery_code_used }); })
      .catch(() => {});
  }, [detalleCarga?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detail panel modal
  if (detalleCarga) {
    const dc = detalleCarga;
    const partes = dc.titulo.split(" — ");
    const tipoCarga = partes[0];
    const ruta = partes[1] ?? dc.titulo;
    const [origen, destino] = ruta.split(" → ");
    const ao = dc.acceptedOffer;
    return (
      <main style={{ maxWidth: 700, margin: "0 auto", padding: "28px 24px", width: "100%", fontFamily: "var(--font-ibm-plex), sans-serif" }}>
        <button onClick={() => setDetalleCarga(null)} style={{ fontSize: 13, color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer", marginBottom: 20, padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>&larr;</span> Volver a Mis cargas
        </button>
        <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, textTransform: "uppercase" as const, letterSpacing: "0.06em", background: dc.ofertas > 0 ? "rgba(234,88,12,0.12)" : ao ? "rgba(22,163,74,0.12)" : "rgba(107,114,128,0.1)", color: dc.ofertas > 0 ? "#ea580c" : ao ? "#16a34a" : "#6b7280" }}>
                {ao ? "ASIGNADA" : dc.ofertas > 0 ? `${dc.ofertas} OFERTA${dc.ofertas > 1 ? "S" : ""}` : "SIN OFERTAS"}
              </span>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 10 }}>{origen} <span style={{ color: "#3a806b" }}>&rarr;</span> {destino}</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#16a34a" }}>
              {ao ? `$${ao.precio.toLocaleString("es-AR")}` : ""}
            </div>
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16, lineHeight: 1.8 }}>
            <div>Tipo de carga: <strong style={{ color: "var(--color-text-primary)" }}>{tipoCarga}</strong></div>
            <div>Peso: <strong style={{ color: "var(--color-text-primary)" }}>{dc.peso}</strong></div>
            <div>Camion requerido: <strong style={{ color: "var(--color-text-primary)" }}>{dc.tipoCamion}</strong></div>
            <div>Fecha de retiro: <strong style={{ color: "var(--color-text-primary)" }}>{dc.retiro}</strong></div>
            <div>Estado: <strong style={{ color: "var(--color-text-primary)" }}>{dc.status}</strong></div>
            {ao && <div>Transportista: <strong style={{ color: "var(--color-text-primary)" }}>{ao.driverName}</strong></div>}
          </div>
          {dc.ofertas > 0 && !ao && (
            <button onClick={() => { setDetalleCarga(null); onVerOfertas(dc); }} style={{ fontSize: 13, padding: "10px 20px", borderRadius: 8, border: "none", background: "#3a806b", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              Ver ofertas ({dc.ofertas})
            </button>
          )}
          {ao && !deliveryCode && (
            <button onClick={() => { setDetalleCarga(null); onIniciarPago({ offerId: ao.offerId, cargaTitulo: dc.titulo, cargaId: dc.id, oferta: { nombre: ao.driverName, precio: ao.precio, offerId: ao.offerId, id: 0, iniciales: ao.driverName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2), rating: 0, viajes: 0, nota: "" } }); }} style={{ fontSize: 13, padding: "10px 20px", borderRadius: 8, border: "none", background: "#3a806b", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              Pagar &rarr;
            </button>
          )}

          {/* Código de entrega — visible una vez que el pago fue confirmado */}
          {deliveryCode && (
            <div style={{ marginTop: 20, background: deliveryCode.used ? "rgba(22,163,74,0.08)" : "rgba(59,130,246,0.08)", border: `1.5px solid ${deliveryCode.used ? "#16a34a" : "#3b82f6"}`, borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: deliveryCode.used ? "#16a34a" : "#3b82f6", marginBottom: 8 }}>
                {deliveryCode.used ? "✓ Entrega confirmada" : "Código de entrega"}
              </div>
              {!deliveryCode.used ? (
                <>
                  <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "0.25em", color: "#111", fontFamily: "monospace", marginBottom: 8 }}>
                    {deliveryCode.code}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 10 }}>
                    Compartí este código con quien recibe la carga.<br />
                    El transportista lo ingresa al llegar al destino para confirmar la entrega y cobrar.
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(deliveryCode.code)}
                    style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "1px solid #3b82f6", background: "transparent", color: "#3b82f6", cursor: "pointer", fontWeight: 600 }}>
                    Copiar código
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 14, color: "#16a34a", fontWeight: 600 }}>
                  El transportista confirmó la entrega exitosamente.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px", width: "100%", fontFamily: "var(--font-ibm-plex), sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>Mis cargas</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>Publica cargas y gestiona ofertas de transportistas</p>
        </div>
        <button onClick={onPublicar} style={{ fontSize: 13, padding: "10px 20px", borderRadius: 8, border: "none", background: "#3a806b", color: "#fff", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" as const }}>
          + Publicar carga
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {([
          { key: "Publicadas" as MisCargasTab, count: publicadas.length },
          { key: "Asignadas" as MisCargasTab, count: asignadas.length },
        ]).map(({ key, count }) => {
          const activo = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: activo ? "rgba(58,128,107,0.12)" : "transparent", color: activo ? "#3a806b" : "var(--color-text-secondary)", fontWeight: activo ? 600 : 400, fontSize: 13 }}>
              {key}
              <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 10, background: activo ? "rgba(58,128,107,0.15)" : "var(--color-background-secondary)", color: activo ? "#3a806b" : "var(--color-text-tertiary)" }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>Cargando...</div>}

      {/* Empty state */}
      {!loading && listado.length === 0 && (
        <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 48, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(61,158,110,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <FontAwesomeIcon icon={faBoxOpen} style={{ width: 20, height: 20, color: "#3a806b" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>
            {tab === "Publicadas" ? "No tenes cargas publicadas" : "No tenes cargas asignadas"}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            {tab === "Publicadas" ? "Publica tu primera carga para empezar a recibir ofertas." : "Las cargas asignadas a un transportista apareceran aca."}
          </div>
        </div>
      )}

      {/* Cards */}
      {!loading && listado.map((c) => {
        const partes = c.titulo.split(" — ");
        const tipoCarga = partes[0];
        const ruta = partes[1] ?? c.titulo;
        const [origen, destino] = ruta.split(" → ");
        const conOfertas = c.ofertas > 0;
        const esAsignada = c.status === "matched" || c.status === "in_transit" || c.status === "accepted";
        const ao = c.acceptedOffer;

        const borderColor = esAsignada ? "#16a34a" : conOfertas ? "#ea580c" : "var(--color-border-tertiary)";

        // Parse price from titulo or acceptedOffer
        const precioDisplay = ao ? `$${ao.precio.toLocaleString("es-AR")}` : null;

        return (
          <div
            key={c.id}
            onClick={() => setDetalleCarga(c)}
            style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderLeft: `3px solid ${borderColor}`, borderRadius: 10, padding: "16px 20px", marginBottom: 10, cursor: "pointer", transition: "box-shadow 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.15)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Badge */}
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, textTransform: "uppercase" as const, letterSpacing: "0.06em", background: esAsignada ? "rgba(22,163,74,0.12)" : conOfertas ? "rgba(234,88,12,0.12)" : "rgba(107,114,128,0.1)", color: esAsignada ? "#16a34a" : conOfertas ? "#ea580c" : "#6b7280" }}>
                  {esAsignada ? "ASIGNADA" : conOfertas ? `${c.ofertas} OFERTA${c.ofertas > 1 ? "S" : ""}` : "SIN OFERTAS"}
                </span>

                {/* Route */}
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 8, marginBottom: 4 }}>
                  {origen} <span style={{ color: "#3a806b" }}>&rarr;</span> {destino}
                </div>

                {/* Detail line */}
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
                  {tipoCarga} · {c.peso} · Retiro: {c.retiro}
                </div>

                {/* Pills */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    `Camion: ${c.tipoCamion}`,
                    c.hace,
                  ].map((pill) => (
                    <span key={pill} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "var(--color-background-secondary)", color: "var(--color-text-tertiary)", border: "0.5px solid var(--color-border-tertiary)" }}>
                      {pill}
                    </span>
                  ))}
                  {ao && (
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(22,163,74,0.08)", color: "#16a34a", border: "0.5px solid rgba(22,163,74,0.2)" }}>
                      {ao.driverName}
                    </span>
                  )}
                </div>
              </div>

              {/* Right side: price + buttons */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
                {precioDisplay && (
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a" }}>{precioDisplay}</div>
                )}
                <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  {!esAsignada && (
                    <button onClick={() => onDestacado(c.titulo)} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 7, border: "1px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>
                      Editar
                    </button>
                  )}
                  {conOfertas && !esAsignada && (
                    <button onClick={() => onVerOfertas(c)} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 7, border: "none", background: "#3a806b", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                      Ver ofertas
                    </button>
                  )}
                  {!conOfertas && !esAsignada && (
                    <button onClick={() => eliminarCarga(c.id)} disabled={eliminando === c.id} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", cursor: eliminando === c.id ? "not-allowed" : "pointer", opacity: eliminando === c.id ? 0.5 : 1 }}>
                      {eliminando === c.id ? "..." : "Eliminar"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </main>
  );
}

// ── Seccion Mis Envios ───────────────────────────────────────────────────────

function SeccionMisEnvios({ cargas }: { cargas: Carga[]; onRefresh: () => void }) {
  const [deliveryCodes, setDeliveryCodes] = useState<Record<string, { code: string; used: boolean }>>({});
  const [mapaAbierto, setMapaAbierto] = useState<string | null>(null);

  const enTransito = cargas.filter((c) => c.status === "in_transit" || c.status === "accepted");
  const entregados = cargas.filter((c) => c.status === "delivered");

  useEffect(() => {
    const inTransit = cargas.filter((c) => c.status === "in_transit" || c.status === "accepted");
    for (const c of inTransit) {
      fetch(`/api/payments/delivery-code?loadId=${c.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.delivery_code) {
            setDeliveryCodes((prev) => ({ ...prev, [c.id]: { code: d.delivery_code, used: !!d.delivery_code_used } }));
          }
        })
        .catch(() => {});
    }
  }, [cargas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mock timeline data generator
  const getTimeline = (c: Carga) => {
    const createdDate = c.hace.includes("día") ? "hace " + c.hace.split("hace ")[1] : c.hace.split("hace ")[1] ?? "hace 2 dias";
    return [
      { label: "Carga publicada", detail: createdDate, status: "done" as const },
      { label: "Transportista asignado", detail: c.acceptedOffer ? c.acceptedOffer.driverName : "—", status: "done" as const },
      { label: "Carga retirada", detail: `Retiro: ${c.retiro}`, status: "done" as const },
      { label: "En camino", detail: "Estimado: en las proximas horas", status: "active" as const },
      { label: "Entregado", detail: "—", status: "pending" as const },
    ];
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px", width: "100%", fontFamily: "var(--font-ibm-plex), sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>Mis envios</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>Segui el estado de tus cargas en transito</p>
      </div>

      {/* Active shipments */}
      {enTransito.length === 0 && entregados.length === 0 && (
        <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 48, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(61,158,110,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <FontAwesomeIcon icon={faTruckFast} style={{ width: 20, height: 20, color: "#3a806b" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>No tenes envios en curso</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Cuando asignes un transportista a una carga, el envio aparecera aca.</div>
        </div>
      )}

      {enTransito.map((c) => {
        const partes = c.titulo.split(" — ");
        const tipoCarga = partes[0];
        const ruta = partes[1] ?? c.titulo;
        const [origen, destino] = ruta.split(" → ");
        const ao = c.acceptedOffer;
        const timeline = getTimeline(c);

        // Mock data for fields not in the Carga interface
        const mockPatente = "AB 123 CD";
        const mockCamionTipo = c.tipoCamion || "Semirremolque";

        return (
          <div key={c.id} style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 24, marginBottom: 16 }}>
            {/* Top row: badge + buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 4, textTransform: "uppercase" as const, letterSpacing: "0.06em", background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
                EN TRANSITO
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setMapaAbierto(mapaAbierto === c.id ? null : c.id)}
                  style={{ fontSize: 12, padding: "6px 14px", borderRadius: 7, border: "1px solid var(--color-border-secondary)", background: mapaAbierto === c.id ? "rgba(58,128,107,0.08)" : "transparent", color: mapaAbierto === c.id ? "#3a806b" : "var(--color-text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <span style={{ fontSize: 13 }}>🗺</span> {mapaAbierto === c.id ? "Ocultar mapa" : "Ver en mapa"}
                </button>
                <button style={{ fontSize: 12, padding: "6px 14px", borderRadius: 7, border: "1px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 14 }}>&#9993;</span> Chat
                </button>
              </div>
            </div>

            {/* Route */}
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 8 }}>
              {origen} <span style={{ color: "#3a806b" }}>&rarr;</span> {destino}
            </div>

            {/* Transportista info */}
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>
              {ao?.driverName ?? "Transportista"} · {mockCamionTipo} · {mockPatente}
              {ao && <span style={{ marginLeft: 8, fontWeight: 600, color: "#16a34a" }}>${ao.precio.toLocaleString("es-AR")}</span>}
            </div>

            {/* Timeline */}
            <div style={{ position: "relative", paddingLeft: 24 }}>
              {/* Vertical line */}
              <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 2, background: "var(--color-border-tertiary)" }} />

              {timeline.map((step, i) => {
                const dotStyle: React.CSSProperties = step.status === "done"
                  ? { width: 12, height: 12, borderRadius: "50%", background: "#16a34a", position: "absolute", left: 0, top: 2 }
                  : step.status === "active"
                  ? { width: 12, height: 12, borderRadius: "50%", background: "transparent", border: "2.5px solid #16a34a", position: "absolute", left: 0, top: 2, boxSizing: "border-box" as const }
                  : { width: 12, height: 12, borderRadius: "50%", background: "transparent", border: "2px solid var(--color-border-secondary)", position: "absolute", left: 0, top: 2, boxSizing: "border-box" as const };

                return (
                  <div key={i} style={{ position: "relative", paddingBottom: i < timeline.length - 1 ? 20 : 0, paddingLeft: 16 }}>
                    <div style={dotStyle} />
                    <div style={{ fontSize: 13, fontWeight: step.status === "active" ? 600 : step.status === "done" ? 500 : 400, color: step.status === "pending" ? "var(--color-text-tertiary)" : "var(--color-text-primary)" }}>
                      {step.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 1 }}>{step.detail}</div>
                  </div>
                );
              })}
            </div>

            {/* Mapa en tiempo real */}
            {mapaAbierto === c.id && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--color-border-tertiary)", paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                  Ubicación en tiempo real
                </div>
                <TripMap loadId={c.id} height={280} />
              </div>
            )}

            {/* Código de entrega */}
            {deliveryCodes[c.id] && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--color-border-tertiary)", paddingTop: 14 }}>
                {deliveryCodes[c.id].used ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
                    <span>✓ Entrega confirmada por el transportista</span>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "var(--color-text-tertiary)", marginBottom: 6 }}>
                      Código de entrega
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.2em", fontFamily: "monospace", color: "var(--color-text-primary)" }}>
                        {deliveryCodes[c.id].code}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(deliveryCodes[c.id].code)}
                        style={{ fontSize: 11, padding: "4px 10px", borderRadius: 5, border: "1px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}
                      >
                        Copiar
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                      Compartí este código con quien recibe la carga. El transportista lo ingresa al llegar al destino.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Historial de envios */}
      {entregados.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", margin: "28px 0 14px" }}>Historial de envios</h2>
          {entregados.map((c) => {
            const partes = c.titulo.split(" — ");
            const tipoCarga = partes[0];
            const ruta = partes[1] ?? c.titulo;
            const [origen, destino] = ruta.split(" → ");
            const ao = c.acceptedOffer;
            return (
              <div key={c.id} style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, padding: "14px 18px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 3 }}>
                    {origen} <span style={{ color: "#3a806b" }}>&rarr;</span> {destino}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {tipoCarga} · {ao?.driverName ?? "—"} · Retiro: {c.retiro}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {ao && <span style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>${ao.precio.toLocaleString("es-AR")}</span>}
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: "rgba(22,163,74,0.12)", color: "#16a34a", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Entregado</span>
                </div>
              </div>
            );
          })}
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

interface Factura { id: string; paymentId: string; offerId: string; fecha: string; concepto: string; camionero: string; monto: number; estado: string; }


function SeccionFacturacion() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const descargar = async (f: Factura) => {
    const url = `/api/invoices/${f.paymentId}/pdf?numero=${encodeURIComponent(f.id)}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `factura-${f.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 500);
  };

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => { if (d.invoices) setFacturas(d.invoices); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalMes = facturas.reduce((acc, f) => acc + f.monto, 0);

  const descargarTodas = () => facturas.forEach((f) => descargar(f));

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
                onClick={() => descargar(f)}
                title="Descargar factura"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "var(--border-radius-md)", border: "none", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}
              >
                <i className="fa-solid fa-download" style={{ fontSize: 16 }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// ── Sección Perfil ────────────────────────────────────────────────────────────

interface DadorStats { totalCargas: number; enTransito: number; memberSince: string; calificacionPromedio: number | null; razonSocial: string | null; cuit: string | null; address: string | null; }

function formatMemberSince(raw: string | null | undefined): string {
  if (!raw) return "—";
  try {
    // Parse the UTC date and adjust to UTC-3 (Argentina)
    const date = new Date(raw);
    const ar = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    const day   = ar.getUTCDate();
    const year  = ar.getUTCFullYear();
    const month = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"][ar.getUTCMonth()];
    return `${day} de ${month} de ${year}`;
  } catch {
    return "—";
  }
}

function SeccionPerfil({ onToast, userName, userEmail }: { onToast: (m: string) => void; userName: string; userEmail: string }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre]     = useState(userName);
  const [telefono, setTelefono] = useState("");
  const [stats, setStats]       = useState<DadorStats | null>(null);
  const initials = nombre.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";

  React.useEffect(() => {
    fetch("/api/stats/dador")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  const card: React.CSSProperties = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 20 };
  const fieldLabel: React.CSSProperties = { fontSize: 11, color: "var(--muted-color)", marginBottom: 3, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.04em" };
  const fieldVal: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: "var(--heading-color)" };

  return (
    <main style={{ padding: "36px 40px", flex: 1, fontFamily: "var(--font-ibm-plex), sans-serif" }}>

      {/* Título */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: "var(--heading-color)", letterSpacing: "-0.02em" }}>Mi perfil</div>
      </div>
      <hr style={{ border: "none", borderTop: "1px solid var(--divider-color)", margin: "20px 0 24px" }} />

      {/* Fila superior: avatar + stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>

        {/* Avatar card */}
        <div style={{ ...card, gridColumn: "1 / 2", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 10, padding: 24 }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#3a806b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff" }}>{initials}</div>
          {editando
            ? <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ fontSize: 15, fontWeight: 700, border: "1px solid var(--card-border)", borderRadius: 8, padding: "4px 8px", background: "var(--page-bg)", color: "var(--heading-color)", outline: "none", textAlign: "center", width: "100%" }} />
            : <div style={{ fontSize: 15, fontWeight: 700, color: "var(--heading-color)", textAlign: "center" }}>{nombre}</div>
          }
          <div style={{ fontSize: 12, color: "var(--body-color)", textAlign: "center" }}>{userEmail}</div>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "var(--color-brand-light)", color: "var(--color-brand-dark)", fontWeight: 600 }}>Verificado <i className="fa-solid fa-circle-check" /></span>
        </div>

        {/* Stats */}
        {[
          { label: "Cargas publicadas",    val: stats ? String(stats.totalCargas) : "—" },
          { label: "En tránsito ahora",    val: stats ? String(stats.enTransito)  : "—" },
          { label: "Calificación promedio",val: stats?.calificacionPromedio != null ? `${stats.calificacionPromedio} ★` : "—" },
        ].map(({ label, val }) => (
          <div key={label} style={{ ...card, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, padding: "20px 24px" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "var(--heading-color)", lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 12, color: "var(--body-color)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Fila inferior: empresa, contacto, actividad */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>

        {/* Datos de empresa */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--heading-color)", marginBottom: 16 }}>Datos de empresa</div>
          <div style={{ display: "grid", gap: 14 }}>
            {[
              { label: "Razón social", val: stats?.razonSocial ?? "—" },
              { label: "CUIT / CUIL",  val: stats?.cuit ?? "—" },
              { label: "Dirección",    val: stats?.address ?? "—" },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={fieldLabel}>{label}</div>
                <div style={fieldVal}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Contacto */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--heading-color)", marginBottom: 16 }}>Contacto</div>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={fieldLabel}>Email</div>
              <div style={fieldVal}>{userEmail || "—"}</div>
            </div>
            <div>
              <div style={fieldLabel}>Teléfono</div>
              {editando
                ? <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 9 11 1234-5678" style={{ fontSize: 13, border: "1px solid var(--card-border)", borderRadius: 8, padding: "6px 10px", background: "var(--page-bg)", color: "var(--heading-color)", outline: "none", width: "100%" }} />
                : <div style={fieldVal}>{telefono || "—"}</div>
              }
            </div>
          </div>
        </div>

        {/* Actividad */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--heading-color)", marginBottom: 16 }}>Actividad</div>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={fieldLabel}>En plataforma desde</div>
              <div style={fieldVal}>{formatMemberSince(stats?.memberSince)}</div>
            </div>
            <div>
              <div style={fieldLabel}>Calificación</div>
              <div style={fieldVal}>{stats?.calificacionPromedio != null ? `${stats.calificacionPromedio} / 5` : "Sin calificaciones aún"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => { if (editando) onToast("Perfil actualizado."); setEditando(!editando); }}
          style={{ fontSize: 13, padding: "9px 20px", borderRadius: 8, border: editando ? "none" : "1px solid var(--inactive-border)", background: editando ? "#3a806b" : "transparent", color: editando ? "#fff" : "var(--heading-color)", cursor: "pointer", fontWeight: 500, fontFamily: "var(--font-ibm-plex), sans-serif" }}
        >
          {editando ? "Guardar cambios" : "Editar perfil"}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          style={{ fontSize: 13, padding: "9px 20px", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", cursor: "pointer", fontWeight: 500, fontFamily: "var(--font-ibm-plex), sans-serif" }}
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}

// ── SeccionInicio (KPIs + dashboard) ─────────────────────────────────────────

interface DadorStats {
  totalCargas: number;
  enTransito: number;
  memberSince: string;
  calificacionPromedio: number | null;
  razonSocial: string | null;
  cuit: string | null;
  address: string | null;
  gastoEsteMes?: number;
  tiempoPromedioAsignacion?: number;
  gastosUltimos6Meses?: { mes: string; monto: number }[];
}

interface OfertaReciente {
  id: string;
  offerId: string;
  loadTitle: string;
  driverName: string;
  precio: number;
  status: string;
}

function SeccionInicio({ cargas, userName, onNavegar }: { cargas: Carga[]; userName: string; onNavegar: (nav: NavItem) => void }) {
  const [stats, setStats] = useState<DadorStats | null>(null);
  const [ofertas, setOfertas] = useState<OfertaReciente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats/dador").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/offers?role=dador").then((r) => (r.ok ? r.json() : null)),
    ]).then(([s, o]) => {
      if (s) setStats(s);
      if (o?.offers) setOfertas(o.offers.slice(0, 4));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const primerNombre = userName.split(" ")[0];
  const hoy = new Date();
  const fechaFormateada = hoy.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  const pendientes = cargas.filter((c) => c.ofertas > 0 && c.status !== "accepted" && c.status !== "in_transit").length;
  const enTransito = cargas.filter((c) => c.status === "in_transit");

  const kpis = [
    { label: "Gasto este mes", value: stats?.gastoEsteMes != null ? `$${stats.gastoEsteMes.toLocaleString("es-AR")}` : "$0", icon: "fa-solid fa-dollar-sign", color: "#16a34a" },
    { label: "Cargas activas", value: cargas.filter((c) => c.status === "available" || c.status === "in_transit").length, icon: "fa-solid fa-box", color: "#3b82f6" },
    { label: "Tiempo prom. asignación", value: stats?.tiempoPromedioAsignacion != null ? `${stats.tiempoPromedioAsignacion}h` : "—", icon: "fa-solid fa-clock", color: "#f59e0b" },
    { label: "Ofertas pendientes", value: pendientes, icon: "fa-solid fa-handshake", color: "#8b5cf6" },
  ];

  const statusLabel: Record<string, { text: string; bg: string; color: string }> = {
    pending: { text: "Pendiente", bg: "rgba(245,158,11,0.1)", color: "#f59e0b" },
    countered: { text: "Contraofertada", bg: "rgba(59,130,246,0.1)", color: "#3b82f6" },
    accepted: { text: "Aceptada", bg: "rgba(22,163,74,0.1)", color: "#16a34a" },
    rejected: { text: "Rechazada", bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
  };

  const meses = stats?.gastosUltimos6Meses ?? [];
  const maxMonto = Math.max(...meses.map((m) => m.monto), 1);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px", width: "100%" }}>
      {/* Saludo */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", margin: 0, fontFamily: "var(--font-ibm-plex), sans-serif" }}>
          Hola, {primerNombre}
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0", textTransform: "capitalize" }}>{fechaFormateada}</p>
      </div>

      {/* Alerta ofertas pendientes */}
      {pendientes > 0 && (
        <div
          onClick={() => onNavegar("Mis cargas")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, marginBottom: 20, cursor: "pointer" }}
        >
          <i className="fa-solid fa-circle-info" style={{ color: "#3b82f6", fontSize: 15 }} />
          <span style={{ fontSize: 13, color: "#3b82f6", fontWeight: 500 }}>
            Tenés {pendientes} carga{pendientes > 1 ? "s" : ""} con ofertas pendientes de revisión
          </span>
        </div>
      )}

      {/* KPIs */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)", fontSize: 13 }}>Cargando...</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {kpis.map((k, i) => (
              <div key={i} style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-primary)", borderRadius: 10, padding: "16px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: `${k.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className={k.icon} style={{ fontSize: 12, color: k.color }} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500 }}>{k.label}</span>
                </div>
                <span style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)" }}>{k.value}</span>
              </div>
            ))}
          </div>

          {/* Dos paneles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            {/* Ofertas recientes */}
            <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-primary)", borderRadius: 10, padding: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 14px" }}>Ofertas recientes</h3>
              {ofertas.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>No hay ofertas recientes</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ofertas.map((o) => {
                    const st = statusLabel[o.status] ?? statusLabel.pending;
                    return (
                      <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--color-background-secondary)", borderRadius: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{o.driverName}</div>
                          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{o.loadTitle}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#16a34a" }}>${o.precio.toLocaleString("es-AR")}</span>
                          <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 6, background: st.bg, color: st.color }}>{st.text}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Envio en curso */}
            <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-primary)", borderRadius: 10, padding: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 14px" }}>Envio en curso</h3>
              {enTransito.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 0", color: "var(--color-text-secondary)" }}>
                  <i className="fa-solid fa-truck" style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }} />
                  <span style={{ fontSize: 13 }}>No hay envios en curso</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {enTransito.slice(0, 1).map((c) => (
                    <div key={c.id} style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)", borderRadius: 10, padding: 16, color: "#fff" }}>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{c.titulo}</div>
                      {c.acceptedOffer && (
                        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Transportista: {c.acceptedOffer.driverName}</div>
                      )}
                      {c.acceptedOffer && (
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#3a806b", marginBottom: 10 }}>${c.acceptedOffer.precio.toLocaleString("es-AR")}</div>
                      )}
                      <button style={{ fontSize: 12, padding: "7px 14px", borderRadius: 7, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontWeight: 500 }}>
                        Ver tracking
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grafico de gastos */}
          {meses.length > 0 && (
            <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-primary)", borderRadius: 10, padding: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 16px" }}>Gasto en fletes ultimos 6 meses</h3>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
                {meses.map((m, i) => {
                  const h = Math.max((m.monto / maxMonto) * 100, 4);
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "var(--color-text-secondary)", fontWeight: 500 }}>${(m.monto / 1000).toFixed(0)}k</span>
                      <div style={{ width: "100%", height: h, background: i === meses.length - 1 ? "#3b82f6" : "rgba(59,130,246,0.25)", borderRadius: 4 }} />
                      <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>{m.mes}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

// ── Onboarding ────────────────────────────────────────────────────────────────

const DADOR_ONBOARDING_STEPS = [
  {
    titulo: "¡Bienvenido a CargaBack! 👋",
    desc: "Te mostramos cómo gestionar tus cargas y envíos. Son solo 3 pasos rápidos.",
    target: null as string | null,
    xOffset: 0,
  },
  {
    titulo: "Gestioná tus cargas",
    desc: "En Mis cargas podés ver todas las cargas que publicaste, las ofertas que recibiste y aceptar al transportista que más te convenga.",
    target: "Mis cargas" as string | null,
    xOffset: 0,
  },
  {
    titulo: "Seguí tus envíos",
    desc: "En Mis envíos encontrás el estado de cada despacho en curso: desde la confirmación hasta la entrega.",
    target: "Mis envios" as string | null,
    xOffset: -40,
  },
];

function DadorOnboardingOverlay({ onFinish, onNavegar }: { onFinish: () => void; onNavegar: (nav: NavItem) => void }) {
  const [paso, setPaso] = useState(0);
  const [arrowX, setArrowX] = useState<number | null>(null);
  const step = DADOR_ONBOARDING_STEPS[paso];
  const esUltimo = paso === DADOR_ONBOARDING_STEPS.length - 1;

  useEffect(() => {
    if (!step.target) { setArrowX(null); return; }
    const spans = document.querySelectorAll<HTMLElement>("button span");
    for (const span of spans) {
      if (span.textContent?.trim() === step.target) {
        const btn = span.closest("button")!;
        const rect = btn.getBoundingClientRect();
        setArrowX(rect.left + rect.width / 2 + step.xOffset);
        return;
      }
    }
    setArrowX(null);
  }, [paso, step.target, step.xOffset]);

  const siguiente = () => {
    if (step.target) onNavegar(step.target as NavItem);
    if (esUltimo) { onFinish(); return; }
    setPaso(paso + 1);
  };

  return (
    <>
      <style>{`
        @keyframes dador-ob-bounce {
          0%   { transform: translateX(-50%) translateY(0); }
          100% { transform: translateX(-50%) translateY(-7px); }
        }
      `}</style>

      {/* Overlay semitransparente */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.18)", pointerEvents: "none" }} />

      {/* Flecha hacia el ítem de nav */}
      {arrowX !== null && (
        <div style={{
          position: "fixed", left: arrowX, top: 66, zIndex: 1002,
          transform: "translateX(-50%)",
          animation: "dador-ob-bounce 0.7s ease-in-out infinite alternate",
          display: "flex", flexDirection: "column", alignItems: "center",
          filter: "drop-shadow(0 2px 6px rgba(58,128,107,0.5))",
          pointerEvents: "none",
        }}>
          <svg width="22" height="30" viewBox="0 0 22 30" fill="none">
            <path d="M11 28 L11 4" stroke="#3a806b" strokeWidth="3" strokeLinecap="round"/>
            <path d="M2 13 L11 4 L20 13" stroke="#3a806b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* Card */}
      <div style={{
        position: "fixed", zIndex: 1001,
        left: "50%", transform: "translateX(-50%)",
        top: arrowX !== null ? 108 : "50%",
        translate: arrowX !== null ? undefined : "0 -50%",
        background: "#3a806b", color: "#fff", borderRadius: 16,
        padding: "32px 36px", maxWidth: 400, width: "90%",
        boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {DADOR_ONBOARDING_STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= paso ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }} />
          ))}
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: "#fff", marginBottom: 10, lineHeight: 1.3 }}>{step.titulo}</h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, marginBottom: 28 }}>{step.desc}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onFinish} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", padding: 0 }}>
            Omitir tour
          </button>
          <button onClick={siguiente} style={{ background: "#fff", color: "#3a806b", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {esUltimo ? "¡Empezar!" : "Siguiente →"}
          </button>
        </div>
      </div>
    </>
  );
}

const NAV_ITEMS: { item: NavItem; icon: IconDefinition }[] = [
  { item: "Inicio",       icon: faHouse },
  { item: "Mis cargas",   icon: faBoxOpen },
  { item: "Mis envios",   icon: faTruckFast },
  { item: "Historial",    icon: faClockRotateLeft },
  { item: "Facturación",  icon: faFileInvoiceDollar },
];

export default function DadorDashboard() {
  const { data: session } = useSession();
  const [navActivo, setNavActivo] = useState<NavItem>("Inicio");
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  const [modalPublicar, setModalPublicar] = useState(false);

  const [showOnboarding, setShowOnboarding] = useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem("theme") === "dark";
    setDarkMode(saved);
    document.documentElement.classList.toggle("dark", saved);
    if (!localStorage.getItem("dador-onboarding-done")) setShowOnboarding(true);
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
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
    <div style={{ background: "var(--page-bg)", minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "var(--font-ibm-plex), sans-serif" }}>

      {/* Topbar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 64, background: darkMode === false ? "#ffffff" : "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)", borderBottom: darkMode === false ? "1px solid #e5e7eb" : "0.5px solid rgba(255,255,255,0.1)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ fontSize: 18, fontWeight: 700, color: darkMode === false ? "#0f1f19" : "#fff", textDecoration: "none", fontFamily: "var(--font-ibm-plex), sans-serif", flexShrink: 0 }}>
            Carga<span style={{ color: "#3a806b" }}>Back</span>
          </Link>
          <nav style={{ display: "flex", height: 64 }}>
            {NAV_ITEMS.map(({ item, icon }) => {
              const activo = navActivo === item;
              const badge = item === "Mis cargas" ? cargas.reduce((s, c) => s + c.ofertas, 0) : 0;
              return (
                <button key={item} onClick={() => setNavActivo(item)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "0 20px", height: "100%",
                  border: "none", borderBottom: activo ? "2.5px solid #3a806b" : "2.5px solid transparent",
                  background: "transparent", cursor: "pointer", position: "relative",
                  fontFamily: "var(--font-ibm-plex), sans-serif",
                }}>
                  <FontAwesomeIcon icon={icon} style={{ width: 14, height: 14, color: activo ? "#3a806b" : darkMode === false ? "#6b7280" : "rgba(255,255,255,0.45)" }} />
                  <span style={{ fontSize: 15, fontWeight: activo ? 600 : 400, color: activo ? (darkMode === false ? "#0f1f19" : "#fff") : darkMode === false ? "#6b7280" : "rgba(255,255,255,0.55)" }}>{item}</span>
                  {badge > 0 && (
                    <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            suppressHydrationWarning
            onClick={toggleDark}
            title={darkMode ? "Modo claro" : "Modo oscuro"}
            style={{ width: 36, height: 36, borderRadius: 8, background: "transparent", border: darkMode === false ? "1px solid #d1d5db" : "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }}
          >
            <FontAwesomeIcon suppressHydrationWarning icon={darkMode ? faSun : faMoon} style={{ width: 16, height: 16, color: darkMode === false ? "#374151" : "rgba(255,255,255,0.7)" }} />
          </button>
          <button onClick={() => setModalPublicar(true)} style={{ fontSize: 13, padding: "9px 18px", borderRadius: 8, background: "#3a806b", border: "none", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ibm-plex), sans-serif" }}>
            + Publicar carga
          </button>
          <button
            onClick={() => setNavActivo("Mi perfil")}
            title="Ver mi perfil"
            style={{ width: 34, height: 34, borderRadius: "50%", background: "#3a806b", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}
          >
            {initials}
          </button>
        </div>
      </header>

      {/* Contenido */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--page-bg)" }}>
        {navActivo === "Inicio" && <SeccionInicio cargas={cargas} userName={userName} onNavegar={setNavActivo} />}
        {navActivo === "Mis cargas" && (
          <SeccionMisCargas
            cargas={cargas}
            loading={loadingCargas}
            onVerOfertas={(c) => setModalOfertas(c)}
            onDestacado={(titulo) => mostrarToast(`Carga "${titulo.split("—")[0].trim()}" destacada. Mas camioneros la veran primero.`)}
            onIniciarPago={(sel) => setModalPago(sel)}
            onRefresh={fetchCargas}
            onPublicar={() => setModalPublicar(true)}
          />
        )}
        {navActivo === "Mis envios" && <SeccionMisEnvios cargas={cargas} onRefresh={fetchCargas} />}
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

      {showOnboarding && (
        <DadorOnboardingOverlay
          onFinish={() => { localStorage.setItem("dador-onboarding-done", "1"); setShowOnboarding(false); }}
          onNavegar={setNavActivo}
        />
      )}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
