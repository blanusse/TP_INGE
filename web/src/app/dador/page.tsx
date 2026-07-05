"use client";
/* eslint-disable react-hooks/set-state-in-effect */


import React, { useState, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { io } from "socket.io-client";

const TripMap = dynamic(() => import("@/app/_components/TripMap"), { ssr: false });
import { signOut, useSession } from "next-auth/react";
import ModalPerfilPublico from "@/app/_components/ModalPerfilPublico";
import ModalReportar from "@/app/_components/ModalReportar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faClockRotateLeft, faFileInvoiceDollar, faHouse, faTruckFast, faSun, faMoon } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

// ── Datos ────────────────────────────────────────────────────────────────────


// ── Tipos ────────────────────────────────────────────────────────────────────

type NavItem = "Inicio" | "Mis cargas" | "Mis envios" | "Historial" | "Facturación" | "Mi perfil";
type TabItem = "Todas" | "Con ofertas" | "Sin ofertas" | "Confirmadas" | "En tránsito";

interface Oferta { id: number; offerId: string; driverId?: string | null; nombre: string; iniciales: string; rating: number; viajes: number; precio: number; counterPrice?: number | null; status?: string; nota: string; telefono?: string | null; email?: string | null; dni?: string | null; }
interface AcceptedOffer { offerId: string; driverName: string; precio: number; }
interface Carga { id: string; titulo: string; hace: string; peso: string; tipoCamion: string; retiro: string; precio: number | null; ofertas: number; camioneros: string[]; ofertasDetalle: Oferta[]; status: string; acceptedOffer: AcceptedOffer | null; origenExacto?: string | null; destinoExacto?: string | null; originLat: number | null; originLng: number | null; destLat: number | null; destLng: number | null; truckType: string | null; distanceKm?: number | null }

interface InsuranceProduct {
  id: string;
  name: string;
  insurer: string;
  coverage_type: string;
  price: number;
  conditions: string;
  is_active: boolean;
}

interface InsuranceQuote {
  quote_id: string;
  premium: number;
  coverage_amount: number;
  provider_name: string;
  coverage_days: number;
  details: string[];
}

interface InsurancePolicy {
  id: string;
  product_id?: string | null;
  insurance_name?: string | null;
  insurer_name?: string | null;
  coverage_type?: string | null;
  coverage_starts_at?: string | null;
  coverage_ends_at: string;
  premium: number | string;
  load_id?: string | null;
}

interface LoadDB {
  id: string;
  pickup_city: string;
  dropoff_city: string;
  pickup_exact?: string | null;
  dropoff_exact?: string | null;
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
  pickup_lat?: number | null;
  pickup_lon?: number | null;
  dropoff_lat?: number | null;
  dropoff_lon?: number | null;
  distance_km?: number | null;
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
    precio:       load.price_base != null ? Number(load.price_base) : null,
    ofertas:      load.offer_count ?? 0,
    camioneros:   [],
    ofertasDetalle: [],
    status:       load.status,
    acceptedOffer: load.accepted_offer ?? null,
    origenExacto: load.pickup_exact ?? null,
    destinoExacto: load.dropoff_exact ?? null,
    originLat: load.pickup_lat ? Number(load.pickup_lat) : null,
    originLng: load.pickup_lon ? Number(load.pickup_lon) : null,
    destLat:   load.dropoff_lat ? Number(load.dropoff_lat) : null,
    destLng:   load.dropoff_lon ? Number(load.dropoff_lon) : null,
    truckType: load.truck_type_required ?? null,
    distanceKm: load.distance_km != null ? Number(load.distance_km) : null,
  };
}

function normalizeCargoType(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function ModalPublicar({ onClose, onPublicar, cargaEditar }: { onClose: () => void; onPublicar: (c: Carga) => void; cargaEditar?: Carga }) {
  const editando = !!cargaEditar;

  const tipoCargaInicial = editando ? (cargaEditar!.titulo.split("—")[0]?.trim() ?? "General") : "General";
  const pesoInicial = editando && cargaEditar!.peso !== "—" ? cargaEditar!.peso.replace(/[^\d]/g, "") : "";
  const precioInicial = editando && cargaEditar!.precio != null ? String(cargaEditar!.precio) : "";
  const retiroInicial = editando && cargaEditar!.retiro !== "—"
    ? (() => { const [d, m, y] = cargaEditar!.retiro.split("/"); return `${y}-${m?.padStart(2, "0")}-${d?.padStart(2, "0")}`; })()
    : "";
  const origenInicial = editando ? (cargaEditar!.origenExacto ?? "") : "";
  const destinoInicial = editando ? (cargaEditar!.destinoExacto ?? "") : "";

  const [form, setForm] = useState({ origen: origenInicial, destino: destinoInicial, tipoCarga: tipoCargaInicial, tipoCamion: editando ? cargaEditar!.tipoCamion : "Cualquiera", peso: pesoInicial, precio: precioInicial, retiro: retiroInicial });
  const [origenMeta,  setOrigenMeta]  = useState<UbicacionMeta | null>(editando ? { zone: "", lat: 0, lon: 0 } : null);
  const [destinoMeta, setDestinoMeta] = useState<UbicacionMeta | null>(editando ? { zone: "", lat: 0, lon: 0 } : null);
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
    if (!editando && !origenMeta) { setError("El origen debe ser una dirección específica. Escribí y seleccioná una opción del listado."); return; }
    if (!editando && !destinoMeta) { setError("El destino debe ser una dirección específica. Escribí y seleccioná una opción del listado."); return; }
    if (form.precio && Number(form.precio) <= 0) { setError("El precio debe ser mayor a 0."); return; }
    if (form.peso && Number(form.peso) <= 0) { setError("El peso debe ser mayor a 0."); return; }
    setLoading(true);
    setError(null);
    try {
      if (editando) {
        const res = await fetch("/api/loads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loadId: cargaEditar!.id, ...form }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message ?? data.error ?? "Error al guardar."); return; }
        onPublicar(loadToCard(data.load));
      } else {
        const res = await fetch("/api/loads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            origenZona:  origenMeta?.zone  ?? undefined,
            destinoZona: destinoMeta?.zone ?? undefined,
            origenLat:   origenMeta?.lat   ?? undefined,
            origenLon:   origenMeta?.lon   ?? undefined,
            destinoLat:  destinoMeta?.lat  ?? undefined,
            destinoLon:  destinoMeta?.lon  ?? undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message ?? data.error ?? "Error al publicar."); return; }
        onPublicar(loadToCard(data.load));
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={editando ? "Editar carga" : "Publicar nueva carga"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Origen {!editando && "*"}</label>
            {editando ? (
              <input value={form.origen || "—"} disabled style={{ ...inputStyle, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" }} />
            ) : (
              <InputUbicacion
                id="origen"
                value={form.origen}
                onChange={(v) => { set("origen", v); setOrigenMeta(null); }}
                onSelect={(r) => { set("origen", r.label); setOrigenMeta({ zone: r.zone, lat: r.lat, lon: r.lon }); }}
                placeholder="Dirección exacta de retiro"
                confirmed={origenMeta !== null}
              />
            )}
            {!editando && origenMeta && origenMeta.zone && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 3 }}><i className="fa-solid fa-location-dot" /> Zona visible a camioneros: <strong>{origenMeta.zone}</strong></div>}
          </div>
          <div>
            <label style={labelStyle}>Destino {!editando && "*"}</label>
            {editando ? (
              <input value={form.destino || "—"} disabled style={{ ...inputStyle, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" }} />
            ) : (
              <InputUbicacion
                id="destino"
                value={form.destino}
                onChange={(v) => { set("destino", v); setDestinoMeta(null); }}
                onSelect={(r) => { set("destino", r.label); setDestinoMeta({ zone: r.zone, lat: r.lat, lon: r.lon }); }}
                placeholder="Dirección exacta de entrega"
                confirmed={destinoMeta !== null}
              />
            )}
            {!editando && destinoMeta && destinoMeta.zone && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 3 }}><i className="fa-solid fa-location-dot" /> Zona visible a camioneros: <strong>{destinoMeta.zone}</strong></div>}
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
            <label style={labelStyle}>Peso estimado (kg) {!editando && "*"}</label>
            <input required={!editando} min="0" type="number" value={form.peso} onChange={(e) => set("peso", e.target.value)} placeholder="ej: 22000" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Precio base (ARS) {!editando && "*"}</label>
            <input
              required={!editando} min="0" type="number" value={form.precio}
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
            {loading ? (editando ? "Guardando..." : "Publicando...") : (editando ? "Guardar cambios →" : "Publicar carga →")}
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

function ModalCalificarCamionero({ offerId, driverName, driverId, onClose }: { offerId: string; driverName: string; driverId?: string | null; onClose: () => void }) {
  const [score, setScore]       = useState(0);
  const [hover, setHover]       = useState(0);
  const [comment, setComment]   = useState("");
  const [enviando, setEnviando] = useState(false);
  const [done, setDone]         = useState(false);
  const [showReportar, setShowReportar] = useState(false);

  const enviar = async () => {
    if (!score) return;
    setEnviando(true);
    try {
      await fetch("/api/ratings", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ offerId, score, ...(comment.trim() ? { comment: comment.trim() } : {}) }),
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
        <div style={{ marginBottom: 16, textAlign: "left" }}>
          <textarea
            maxLength={300}
            placeholder="Comentario opcional (máx. 300 caracteres)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ width: "100%", minHeight: 72, fontSize: 13, padding: "8px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", resize: "vertical", color: "var(--color-text-primary)", background: "var(--color-background-primary)", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "right", marginTop: 2 }}>{comment.length}/300</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
            Omitir
          </button>
          <button onClick={enviar} disabled={!score || enviando} style={{ flex: 2, fontSize: 13, padding: "10px", borderRadius: "var(--border-radius-md)", border: "none", background: score ? "var(--color-brand)" : "var(--color-background-secondary)", color: score ? "#fff" : "var(--color-text-tertiary)", cursor: score ? "pointer" : "not-allowed", fontWeight: 600 }}>
            {enviando ? "Enviando..." : "Enviar calificación"}
          </button>
        </div>
        {driverId && (
          <button onClick={() => setShowReportar(true)} style={{ display: "block", margin: "14px auto 0", fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>
            Reportar comportamiento
          </button>
        )}
        {showReportar && driverId && (
          <ModalReportar reportedUserId={driverId} reportedUserName={driverName} onClose={() => setShowReportar(false)} onSuccess={() => setShowReportar(false)} />
        )}
      </div>
    </Modal>
  );
}

// ── Chat (reutilizable como inline o modal) ───────────────────────────────────

interface MensajeChat { id: string; senderId: string; texto: string; hora: string; }

function ChatInline({ sel, userId }: { sel: OfertaSeleccionada; userId: string }) {
  const { data: session } = useSession();
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto]       = useState("");
  const [enviando, setEnviando] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const mapMsg = (m: { id: string; sender_id: string; content: string; created_at: string }) => ({
      id: m.id, senderId: m.sender_id, texto: m.content,
      hora: m.created_at ? new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "",
    });

    fetch(`/api/messages?offerId=${sel.offerId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.messages) {
          setMensajes(d.messages.map(mapMsg));
          setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
        }
      })
      .catch(() => {});

    const token = session?.backendToken;
    if (!token) return;

    let disposed = false;
    let socket: ReturnType<typeof io> | null = null;

    fetch("/api/config")
      .then((r) => r.json())
      .then(({ backendUrl }: { backendUrl: string }) => {
        if (disposed) return;
        socket = io(`${backendUrl}/messages`, { auth: { token } });
        socket.on("connect", () => { socket?.emit("join", sel.offerId); });
        socket.on("joined", (_offerId: string) => { /* room confirmed */ });
        socket.on("new_message", (msg: { id: string; sender_id: string; content: string; created_at: string }) => {
          if (msg.sender_id === userId) return;
          const m = mapMsg(msg);
          setMensajes((prev) => {
            if (prev.some((p) => p.id === m.id)) return prev; // de-duplicate
            return [...prev, m];
          });
          setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
        });
      })
      .catch(() => {});

    return () => { disposed = true; socket?.disconnect(); };
  }, [sel.offerId, session?.backendToken]);

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
        setMensajes((prev) => [...prev, { id: m.id, senderId: m.sender_id, texto: m.content, hora: m.created_at ? new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "" }]);
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
                {m.texto.startsWith("data:image/") ? (
                  <img src={m.texto} alt="imagen" onClick={() => setLightbox(m.texto)} style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 6, display: "block", cursor: "zoom-in" }} />
                ) : (
                  m.texto
                )}
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
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <img src={lightbox} alt="imagen ampliada" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }} />
        </div>
      )}
    </div>
  );
}

function ModalChat({ sel, onClose, userId }: { sel: OfertaSeleccionada; onClose: () => void; userId: string }) {
  const [showPerfil, setShowPerfil] = useState(false);
  const [showReportar, setShowReportar] = useState(false);
  return (
    <>
      <Modal title={`Chat con ${sel.oferta.nombre}`} onClose={onClose}>
        {sel.oferta.driverId && (
          <div style={{ textAlign: "right", marginBottom: 8 }}>
            <button onClick={() => setShowPerfil(true)} style={{ fontSize: 12, color: "var(--color-brand)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Ver perfil</button>
          </div>
        )}
        <ChatInline sel={sel} userId={userId} />
      </Modal>
      {showPerfil && sel.oferta.driverId && (
        <ModalPerfilPublico userId={sel.oferta.driverId} onClose={() => setShowPerfil(false)} onReportar={() => { setShowPerfil(false); setShowReportar(true); }} />
      )}
      {showReportar && sel.oferta.driverId && (
        <ModalReportar reportedUserId={sel.oferta.driverId} reportedUserName={sel.oferta.nombre} onClose={() => setShowReportar(false)} onSuccess={() => setShowReportar(false)} />
      )}
    </>
  );
}

// ── Secciones ─────────────────────────────────────────────────────────────────

function SeccionMisCargas({
  cargas,
  loading,
  onVerOfertas,
  onToast,
  onIniciarPago,
  onRefresh,
  onPublicar,
}: {
  cargas: Carga[];
  loading: boolean;
  onVerOfertas: (c: Carga) => void;
  onToast: (msg: string) => void;
  onIniciarPago: (sel: OfertaSeleccionada) => void;
  onRefresh: () => void;
  onPublicar: () => void;
}) {
  type MisCargasTab = "Publicadas" | "Asignadas";
  const [tab, setTab] = useState<MisCargasTab>("Publicadas");
  const [detalleCarga, setDetalleCarga] = useState<Carga | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [editando, setEditando] = useState<Carga | null>(null);
  const [deliveryCode, setDeliveryCode] = useState<{ code: string; used: boolean } | null>(null);
  const [insurancePolicy, setInsurancePolicy] = useState<InsurancePolicy | null>(null);
  const [insuranceProducts, setInsuranceProducts] = useState<InsuranceProduct[]>([]);
  const [selectedInsuranceProductId, setSelectedInsuranceProductId] = useState("");
  const [insuranceQuote, setInsuranceQuote] = useState<InsuranceQuote | null>(null);
  const [declaredValue, setDeclaredValue] = useState("");
  const [loadingInsurance, setLoadingInsurance] = useState(false);
  const [quotingInsurance, setQuotingInsurance] = useState(false);
  const [purchasingInsurance, setPurchasingInsurance] = useState(false);
  const [insuranceError, setInsuranceError] = useState<string | null>(null);

  const publicadas = cargas.filter((c) => c.status === "available");
  const asignadas = cargas.filter((c) => c.status === "matched" || c.status === "in_transit" || c.status === "accepted");
  const detalleCargaId = detalleCarga?.id;
  const detalleCargaStatus = detalleCarga?.status;

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

  useEffect(() => {
    if (!detalleCargaId || !detalleCargaStatus) {
      setInsurancePolicy(null);
      setInsuranceProducts([]);
      setSelectedInsuranceProductId("");
      setInsuranceQuote(null);
      setDeclaredValue("");
      setInsuranceError(null);
      return;
    }

    const esViaje = detalleCargaStatus === "matched" || detalleCargaStatus === "in_transit" || detalleCargaStatus === "delivered" || detalleCargaStatus === "accepted";
    if (!esViaje) {
      setInsurancePolicy(null);
      setInsuranceProducts([]);
      setSelectedInsuranceProductId("");
      setInsuranceQuote(null);
      setDeclaredValue("");
      setInsuranceError(null);
      return;
    }

    let ignore = false;
    const cargarSeguro = async () => {
      setLoadingInsurance(true);
      setInsuranceError(null);
      try {
        const [policyRes, productsRes] = await Promise.all([
          fetch(`/api/insurance/policies?loadId=${detalleCargaId}`),
          fetch("/api/insurance/products"),
        ]);

        const policyJson = await policyRes.json();
        const productsJson = await productsRes.json();

        if (ignore) return;

        const products: InsuranceProduct[] = Array.isArray(productsJson)
          ? productsJson
          : [];
        const policies: InsurancePolicy[] = Array.isArray(policyJson)
          ? policyJson
          : [];
        const policy = policies.length > 0 ? policies[0] : null;

        setInsuranceProducts(products);
        setInsurancePolicy(policy);
        setInsuranceQuote(null);
        setDeclaredValue("");
        setSelectedInsuranceProductId((prev) => {
          if (policy?.product_id) return policy.product_id;
          if (prev) return prev;
          return products[0]?.id ?? "";
        });
      } catch {
        if (!ignore) setInsuranceError("No se pudo cargar la informacion de seguro.");
      } finally {
        if (!ignore) setLoadingInsurance(false);
      }
    };

    cargarSeguro();
    return () => { ignore = true; };
  }, [detalleCargaId, detalleCargaStatus]);

  const cotizarSeguro = async (carga: Carga, origen: string, destino: string) => {
    if (!declaredValue || isNaN(Number(declaredValue)) || Number(declaredValue) <= 0) {
      setInsuranceError("Ingresá un valor declarado valido para cotizar.");
      return;
    }

    setQuotingInsurance(true);
    setInsuranceError(null);
    try {
      const res = await fetch("/api/insurance/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          declared_value: Number(declaredValue),
          cargo_type: normalizeCargoType(carga.titulo.split(" — ")[0] ?? "otro"),
          distance_km: carga.distanceKm ?? undefined,
          pickup_city: origen,
          dropoff_city: destino,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setInsuranceError(data.message ?? data.error ?? "No se pudo cotizar el seguro.");
        return;
      }

      setInsuranceQuote(data as InsuranceQuote);
    } catch {
      setInsuranceError("No se pudo cotizar el seguro.");
    } finally {
      setQuotingInsurance(false);
    }
  };

  const contratarSeguro = async (carga: Carga, origen: string, destino: string) => {
    if (!insuranceQuote) {
      setInsuranceError("Primero tenés que cotizar el seguro.");
      return;
    }
    if (!selectedInsuranceProductId) {
      setInsuranceError("Seleccioná un seguro para contratar.");
      return;
    }
    if (!declaredValue || isNaN(Number(declaredValue)) || Number(declaredValue) <= 0) {
      setInsuranceError("Ingresá un valor declarado valido.");
      return;
    }

    setPurchasingInsurance(true);
    setInsuranceError(null);
    try {
      const res = await fetch("/api/insurance/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedInsuranceProductId,
          load_id: carga.id,
          quote_id: insuranceQuote.quote_id,
          declared_value: Number(declaredValue),
          cargo_type: normalizeCargoType(carga.titulo.split(" — ")[0] ?? "otro"),
          distance_km: carga.distanceKm ?? undefined,
          pickup_city: origen,
          dropoff_city: destino,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setInsuranceError(data.message ?? data.error ?? "No se pudo contratar el seguro.");
        return;
      }

      setInsurancePolicy(data as InsurancePolicy);
      setInsuranceQuote(null);
      onToast("Seguro contratado correctamente. Te enviamos la confirmacion por email.");
    } catch {
      setInsuranceError("No se pudo contratar el seguro.");
    } finally {
      setPurchasingInsurance(false);
    }
  };

  // Detail panel modal
  if (detalleCarga) {
    const dc = detalleCarga;
    const partes = dc.titulo.split(" — ");
    const tipoCarga = partes[0];
    const ruta = partes[1] ?? dc.titulo;
    const [origen, destino] = ruta.split(" → ");
    const ao = dc.acceptedOffer;
    const esViajeConSeguro = dc.status === "matched" || dc.status === "in_transit" || dc.status === "delivered" || dc.status === "accepted";
    const primaSeguro = insurancePolicy ? Number(insurancePolicy.premium) : null;
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
              {(dc.origenExacto || dc.destinoExacto) && (
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 6, lineHeight: 1.7 }}>
                  {dc.origenExacto && <div>&#128205; <strong>Origen:</strong> {dc.origenExacto}</div>}
                  {dc.destinoExacto && <div>&#128205; <strong>Destino:</strong> {dc.destinoExacto}</div>}
                </div>
              )}
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

          {esViajeConSeguro && (
            <div style={{ marginBottom: 18, background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 10 }}>
                Seguro del viaje
              </div>

              {loadingInsurance && (
                <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
                  Cargando informacion de cobertura...
                </div>
              )}

              {!loadingInsurance && insurancePolicy && (
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                  <div>Estado: <strong style={{ color: "#16a34a" }}>Contratado</strong></div>
                  <div>Seguro: <strong style={{ color: "var(--color-text-primary)" }}>{insurancePolicy.insurance_name ?? "Seguro de carga"}</strong></div>
                  <div>Aseguradora: <strong style={{ color: "var(--color-text-primary)" }}>{insurancePolicy.insurer_name ?? "CargaBack Seguros"}</strong></div>
                  <div>Cobertura: <strong style={{ color: "var(--color-text-primary)" }}>{insurancePolicy.coverage_type ?? "Cobertura de carga"}</strong></div>
                  <div>Viaje asociado: <strong style={{ color: "var(--color-text-primary)" }}>{origen} → {destino}</strong></div>
                  <div>Vigencia: <strong style={{ color: "var(--color-text-primary)" }}>{formatDateTime(insurancePolicy.coverage_starts_at)} al {formatDateTime(insurancePolicy.coverage_ends_at)}</strong></div>
                  {primaSeguro != null && !isNaN(primaSeguro) && (
                    <div>Prima: <strong style={{ color: "var(--color-text-primary)" }}>${primaSeguro.toLocaleString("es-AR")}</strong></div>
                  )}
                </div>
              )}

              {!loadingInsurance && !insurancePolicy && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
                    Todavia no contrataste un seguro para este viaje.
                  </div>

                  {insuranceProducts.length > 0 ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                        <div>
                          <label style={{ ...labelStyle, marginBottom: 4 }}>Seguro</label>
                          <select
                            value={selectedInsuranceProductId}
                            onChange={(e) => setSelectedInsuranceProductId(e.target.value)}
                            style={{ ...selectStyle, fontSize: 12, padding: "7px 9px" }}
                          >
                            {insuranceProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {p.insurer}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ ...labelStyle, marginBottom: 4 }}>Valor declarado (ARS)</label>
                          <input
                            type="number"
                            min={1}
                            value={declaredValue}
                            onChange={(e) => setDeclaredValue(e.target.value)}
                            style={{ ...inputStyle, fontSize: 12, padding: "7px 9px" }}
                            placeholder="Ej: 1500000"
                          />
                        </div>
                      </div>

                      {selectedInsuranceProductId && (
                        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 8, lineHeight: 1.5 }}>
                          {insuranceProducts.find((p) => p.id === selectedInsuranceProductId)?.conditions}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, marginBottom: insuranceQuote ? 10 : 0 }}>
                        <button
                          onClick={() => cotizarSeguro(dc, origen, destino)}
                          disabled={quotingInsurance || purchasingInsurance}
                          style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, border: "1px solid #3a806b", background: "transparent", color: "#3a806b", cursor: "pointer", fontWeight: 600 }}
                        >
                          {quotingInsurance ? "Cotizando..." : "Cotizar seguro"}
                        </button>

                        {insuranceQuote && (
                          <button
                            onClick={() => contratarSeguro(dc, origen, destino)}
                            disabled={purchasingInsurance || quotingInsurance}
                            style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, border: "none", background: "#3a806b", color: "#fff", cursor: "pointer", fontWeight: 600 }}
                          >
                            {purchasingInsurance ? "Contratando..." : "Contratar seguro"}
                          </button>
                        )}
                      </div>

                      {insuranceQuote && (
                        <div style={{ marginTop: 10, fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6, background: "rgba(58,128,107,0.08)", border: "1px solid rgba(58,128,107,0.2)", borderRadius: 8, padding: 10 }}>
                          <div>Prima estimada: <strong style={{ color: "var(--color-text-primary)" }}>${Number(insuranceQuote.premium).toLocaleString("es-AR")}</strong></div>
                          <div>Cobertura: <strong style={{ color: "var(--color-text-primary)" }}>${Number(insuranceQuote.coverage_amount).toLocaleString("es-AR")}</strong></div>
                          <div>Vigencia: <strong style={{ color: "var(--color-text-primary)" }}>{insuranceQuote.coverage_days} dias</strong></div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
                      No hay productos de seguro activos para contratar.
                    </div>
                  )}
                </div>
              )}

              {insuranceError && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "8px 10px" }}>
                  {insuranceError}
                </div>
              )}
            </div>
          )}

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
    <>
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px", width: "100%", fontFamily: "var(--font-ibm-plex), sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>Mis cargas</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>Publica cargas y gestiona ofertas de transportistas</p>
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
                    <button onClick={() => setEditando(c)} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 7, border: "1px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>
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
    {editando && (
      <ModalPublicar
        cargaEditar={editando}
        onClose={() => setEditando(null)}
        onPublicar={() => { onRefresh(); setEditando(null); }}
      />
    )}
    </>
  );
}

// ── Seccion Mis Envios ───────────────────────────────────────────────────────

function SeccionMisEnvios({ cargas, userId }: { cargas: Carga[]; onRefresh: () => void; userId: string }) {
  const [deliveryCodes, setDeliveryCodes] = useState<Record<string, { code: string; used: boolean }>>({});
  const [mapaAbierto, setMapaAbierto] = useState<string | null>(null);
  const [chatAbierto, setChatAbierto] = useState<string | null>(null);

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
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
                  {mapaAbierto === c.id ? "Ocultar mapa" : "Ver en mapa"}
                </button>
                {ao && (
                  <button
                    onClick={() => setChatAbierto(chatAbierto === c.id ? null : c.id)}
                    style={{ fontSize: 12, padding: "6px 14px", borderRadius: 7, border: "1px solid var(--color-border-secondary)", background: chatAbierto === c.id ? "rgba(58,128,107,0.08)" : "transparent", color: chatAbierto === c.id ? "#3a806b" : "var(--color-text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <span style={{ fontSize: 14 }}>&#9993;</span> {chatAbierto === c.id ? "Ocultar chat" : "Chat"}
                  </button>
                )}
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
                <TripMap
                  loadId={c.id}
                  originLat={c.originLat}
                  originLng={c.originLng}
                  destLat={c.destLat}
                  destLng={c.destLng}
                  truckType={c.truckType}
                  height={280}
                />
              </div>
            )}

            {/* Chat en tiempo real */}
            {chatAbierto === c.id && ao && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--color-border-tertiary)", paddingTop: 16 }}>
                <ChatInline
                  sel={{ offerId: ao.offerId, cargaTitulo: c.titulo, cargaId: c.id, oferta: { id: 0, offerId: ao.offerId, driverId: null, nombre: ao.driverName, iniciales: ao.driverName.charAt(0), rating: 0, viajes: 0, precio: ao.precio, nota: "" } }}
                  userId={userId}
                />
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

      {/* Acceso a la simulación de viaje */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--color-border-tertiary)", display: "flex", justifyContent: "center" }}>
        <Link
          href="/dev/mapa"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 8, background: "#3a806b", color: "#fff", textDecoration: "none" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          Ver simulación de viaje
        </Link>
      </div>
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
      .then((d) => {
        if (d.conversations) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setConvs(d.conversations.map((c: any) => ({
            offerId:       c.offer_id,
            cargaTitulo:   c.load_title ?? `${c.pickup_city} → ${c.dropoff_city}`,
            otherUserName: c.other_party ?? "Transportista",
            precio:        Number(c.price),
            lastMessage:   c.last_message ?? null,
            lastMessageTime: c.last_message_at
              ? new Date(c.last_message_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
              : null,
          })));
        }
      })
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
            {c.lastMessage && <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.lastMessage.startsWith("data:image/") ? "📷 Imagen" : c.lastMessage}</div>}
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
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflowX: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>
          <div style={{ minWidth: 520 }}>
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
        </div>
      )}
    </main>
  );
}



// ── Sección Perfil ────────────────────────────────────────────────────────────

interface DadorStats { totalCargas: number; enTransito: number; memberSince: string; calificacionPromedio: number | null; tipo: string | null; phone: string | null; dni: string | null; razonSocial: string | null; cuit: string | null; address: string | null; }
interface RatingEntry { id: string; score: number; comment: string | null; created_at: string; from_user?: { id: string; name: string } | null; }

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
  const [dniVerified, setDniVerified] = useState<boolean | null>(null);
  const [dniUploading, setDniUploading] = useState(false);
  const [dniMsg, setDniMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [verifyingIdentity, setVerifyingIdentity] = useState(false);
  const [identityMessage, setIdentityMessage] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const { data: session } = useSession();
  const [ratings, setRatings] = useState<RatingEntry[]>([]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const initials = nombre.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";

  React.useEffect(() => {
    fetch("/api/stats/dador")
      .then((r) => r.json())
      .then((d) => { setStats(d); if (d.phone) setTelefono(d.phone); })
      .catch(() => {});
    fetch("/api/documents/verify-dni")
      .then((r) => r.json())
      .then((d) => setDniVerified(d.dni_verified ?? false))
      .catch(() => {});
    fetch("/api/documents/identity-status")
      .then((r) => r.json())
      .then((d) => { if (d.identity_verified) setIdentityVerified(true); })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/ratings/user/${session.user.id}`).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setRatings(d); }).catch(() => {});
  }, [session?.user?.id]);

  const handleVerifyIdentity = async () => {
    setVerifyingIdentity(true);
    setIdentityMessage("");
    try {
      const res = await fetch("/api/documents/verify-identity", { method: "POST" });
      const data = await res.json();
      setIdentityMessage(data.message);
      if (data.verified) setIdentityVerified(true);
    } catch {
      setIdentityMessage("Error de conexión. Intentá más tarde.");
    } finally {
      setVerifyingIdentity(false);
    }
  };

  async function handleDniUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDniUploading(true);
    setDniMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/documents/verify-dni", { method: "POST", body: fd });
      const data = await res.json();
      if (data.verified) {
        setDniVerified(true);
        setDniMsg({ ok: true, text: "DNI verificado correctamente." });
        onToast("DNI verificado.");
      } else {
        setDniMsg({ ok: false, text: data.message ?? "No se pudo verificar el DNI." });
      }
    } catch {
      setDniMsg({ ok: false, text: "Error al subir la imagen." });
    } finally {
      setDniUploading(false);
      e.target.value = "";
    }
  }

  const card: React.CSSProperties = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 20 };
  const fieldLabel: React.CSSProperties = { fontSize: 11, color: "var(--muted-color)", marginBottom: 3, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.04em" };
  const fieldVal: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: "var(--heading-color)" };

  return (
    <main style={{ padding: isMobile ? "16px 12px" : "36px 40px", flex: 1, fontFamily: "var(--font-ibm-plex), sans-serif" }}>

      {/* Título */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: "var(--heading-color)", letterSpacing: "-0.02em" }}>Mi perfil</div>
      </div>
      <hr style={{ border: "none", borderTop: "1px solid var(--divider-color)", margin: "20px 0 24px" }} />

      {/* Fila superior: avatar + stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>

        {/* Avatar card */}
        <div style={{ ...card, gridColumn: "1 / 2", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 10, padding: 24 }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#3a806b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff" }}>{initials}</div>
          {editando
            ? <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ fontSize: 15, fontWeight: 700, border: "1px solid var(--card-border)", borderRadius: 8, padding: "4px 8px", background: "var(--page-bg)", color: "var(--heading-color)", outline: "none", textAlign: "center", width: "100%" }} />
            : <div style={{ fontSize: 15, fontWeight: 700, color: "var(--heading-color)", textAlign: "center" }}>{nombre}</div>
          }
          <div style={{ fontSize: 12, color: "var(--body-color)", textAlign: "center" }}>{userEmail}</div>
          {dniVerified && identityVerified
            ? <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "var(--color-brand-light)", color: "var(--color-brand-dark)", fontWeight: 600 }}>Verificado <i className="fa-solid fa-circle-check" /></span>
            : <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>Sin verificar <i className="fa-solid fa-circle-exclamation" /></span>
          }
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

      {/* Fila inferior: empresa (solo si es empresa), contacto, actividad */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : (stats?.tipo === "empresa" ? "1fr 1fr 1fr" : "1fr 1fr"), gap: 12, marginBottom: 20 }}>

        {/* Datos de empresa — solo visible si tipo === 'empresa' */}
        {stats?.tipo === "empresa" && (
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
        )}

        {/* Contacto */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--heading-color)", marginBottom: 16 }}>Contacto</div>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={fieldLabel}>Email</div>
              <div style={fieldVal}>{userEmail || "—"}</div>
            </div>
            <div>
              <div style={fieldLabel}>DNI</div>
              <div style={fieldVal}>{stats?.dni ?? "—"}</div>
            </div>
            <div>
              <div style={fieldLabel}>Teléfono</div>
              {editando
                ? <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="9 11 1234-5678" style={{ fontSize: 13, border: "1px solid var(--card-border)", borderRadius: 8, padding: "6px 10px", background: "var(--page-bg)", color: "var(--heading-color)", outline: "none", width: "100%" }} />
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

      {/* Verificación de identidad */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--heading-color)", marginBottom: 4 }}>Verificación de identidad</div>
            <div style={{ fontSize: 12, color: "var(--muted-color)" }}>
              {dniVerified
                ? "Tu DNI fue verificado. Tu cuenta está habilitada para operar."
                : "Subí una foto del frente de tu DNI para verificar tu identidad. El número debe coincidir con el que ingresaste al registrarte."}
            </div>
            {dniMsg && (
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 500, color: dniMsg.ok ? "#065f46" : "#b91c1c" }}>
                {dniMsg.ok ? "✓ " : "✗ "}{dniMsg.text}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {dniVerified
              ? <span style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, background: "#d1fae5", color: "#065f46", fontWeight: 600 }}>✓ DNI verificado</span>
              : (
                <label style={{ display: "inline-block", cursor: dniUploading ? "not-allowed" : "pointer" }}>
                  <input type="file" accept="image/*" onChange={handleDniUpload} disabled={dniUploading} style={{ display: "none" }} />
                  <span style={{ fontSize: 12, padding: "7px 16px", borderRadius: 8, background: dniUploading ? "#e5e7eb" : "#3a806b", color: dniUploading ? "#9ca3af" : "#fff", fontWeight: 600, pointerEvents: "none" }}>
                    {dniUploading ? "Verificando..." : "Subir foto del DNI"}
                  </span>
                </label>
              )
            }
          </div>
        </div>
      </div>

      {/* Verificación AFIP */}
      {dniVerified && (
        <div style={{ ...card, marginBottom: 20, background: identityVerified ? "#d1fae5" : "#fef3c7", border: identityVerified ? "1px solid #6ee7b7" : "1px solid #fcd34d" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            <i className={`fa-solid ${identityVerified ? "fa-circle-check" : "fa-id-card"}`} /> Verificación de identidad (AFIP)
          </div>
          {identityVerified ? (
            <span style={{ color: "#166534" }}>Identidad verificada contra AFIP ✓</span>
          ) : (
            <>
              <p style={{ fontSize: 14, marginBottom: 10, color: "#92400e" }}>
                Validamos tu nombre contra el padrón de AFIP para confirmar tu identidad.
              </p>
              <button
                onClick={handleVerifyIdentity}
                disabled={verifyingIdentity}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none",
                  background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer" }}
              >
                {verifyingIdentity ? "Verificando..." : "Verificar identidad"}
              </button>
              {identityMessage && (
                <p style={{ marginTop: 8, fontSize: 13, color: "#92400e" }}>{identityMessage}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Reseñas */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--heading-color)", marginBottom: 16 }}>Reseñas recibidas</div>
        {ratings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted-color)", fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⭐</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Aún no tenés reseñas</div>
            <div>Cuando completes envíos, los transportistas podrán calificarte aquí.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ratings.map((r) => (
              <div key={r.id} style={{ background: "var(--page-bg)", border: "1px solid var(--card-border)", borderRadius: 8, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#3a806b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {r.from_user?.name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--heading-color)" }}>{r.from_user?.name ?? "Usuario"}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-color)" }}>
                    {new Date(r.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 2, marginBottom: r.comment ? 8 : 4 }}>
                  {[1,2,3,4,5].map((s) => <span key={s} style={{ fontSize: 15, color: s <= r.score ? "#f59e0b" : "#d1d5db" }}>★</span>)}
                </div>
                {r.comment
                  ? <div style={{ fontSize: 13, color: "var(--body-color)", lineHeight: 1.5 }}>{r.comment}</div>
                  : <div style={{ fontSize: 12, color: "var(--muted-color)", fontStyle: "italic" }}>Sin comentario</div>
                }
              </div>
            ))}
          </div>
        )}
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
    { label: "Gasto este mes", value: stats?.gastoEsteMes != null ? `$${stats.gastoEsteMes.toLocaleString("es-AR")}` : "$0", icon: "fa-solid fa-dollar-sign", color: "#16a34a", hideOnMobile: false },
    { label: "Cargas activas", value: cargas.filter((c) => c.status === "available" || c.status === "in_transit").length, icon: "fa-solid fa-box", color: "#16a34a", hideOnMobile: false },
    { label: "Tiempo prom. asignación", value: stats?.tiempoPromedioAsignacion != null ? `${stats.tiempoPromedioAsignacion}h` : "—", icon: "fa-solid fa-clock", color: "#16a34a", hideOnMobile: true },
    { label: "Ofertas pendientes", value: pendientes, icon: "fa-solid fa-handshake", color: "#16a34a", hideOnMobile: false },
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
    <main style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 12px" : "28px 24px", width: "100%" }}>
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
            Tenés {pendientes} oferta{pendientes > 1 ? "s" : ""} pendientes de revisión
          </span>
        </div>
      )}

      {/* KPIs */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)", fontSize: 13 }}>Cargando...</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {kpis.filter((k) => !isMobile || !k.hideOnMobile).map((k, i) => (
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
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
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

// ── Onboarding (desactivado) ──────────────────────────────────────────────────

// const DADOR_ONBOARDING_STEPS = [ ... ];
// function DadorOnboardingOverlay() { ... }

const NAV_ITEMS: { item: NavItem; icon: IconDefinition }[] = [
  { item: "Inicio",       icon: faHouse },
  { item: "Mis cargas",   icon: faBoxOpen },
  { item: "Mis envios",   icon: faTruckFast },
  { item: "Historial",    icon: faClockRotateLeft },
  { item: "Facturación",  icon: faFileInvoiceDollar },
];

export default function DadorPage() {
  return (
    <Suspense fallback={null}>
      <DadorDashboard />
    </Suspense>
  );
}

function DadorDashboard() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [navActivo, setNavActivo] = useState<NavItem>("Inicio");
  const [darkMode, setDarkMode] = useState<boolean | null>(null);

  // Deep-link desde el onboarding: /dador?nav=perfil
  useEffect(() => {
    const nav = searchParams.get("nav");
    if (!nav) return;
    const mapping: Record<string, NavItem> = {
      perfil: "Mi perfil",
      cargas: "Mis cargas",
      envios: "Mis envios",
      historial: "Historial",
      facturacion: "Facturación",
      inicio: "Inicio",
    };
    const mapped = mapping[nav.toLowerCase()];
    if (mapped) setNavActivo(mapped);
  }, [searchParams]);
  const [modalPublicar, setModalPublicar] = useState(false);
  const [dniVerificado, setDniVerificado] = useState<boolean | null>(null);
  const [identityVerificado, setIdentityVerificado] = useState(false);

  // const [showOnboarding, setShowOnboarding] = useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem("theme") === "dark";
    setDarkMode(saved);
    document.documentElement.classList.toggle("dark", saved);
    // if (!localStorage.getItem("dador-onboarding-done")) setShowOnboarding(true);
    fetch("/api/documents/verify-dni")
      .then((r) => r.json())
      .then((d) => setDniVerificado(d.dni_verified ?? false))
      .catch(() => {});
    fetch("/api/documents/identity-status")
      .then((r) => r.json())
      .then((d) => { if (d.identity_verified) setIdentityVerificado(true); })
      .catch(() => {});
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
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
          <nav style={{ display: isMobile ? "none" : "flex", height: 64 }}>
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
          {!isMobile && (
            <button
              suppressHydrationWarning
              onClick={toggleDark}
              title={darkMode ? "Modo claro" : "Modo oscuro"}
              style={{ width: 36, height: 36, borderRadius: 8, background: "transparent", border: darkMode === false ? "1px solid #d1d5db" : "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }}
            >
              <FontAwesomeIcon suppressHydrationWarning icon={darkMode ? faSun : faMoon} style={{ width: 16, height: 16, color: darkMode === false ? "#374151" : "rgba(255,255,255,0.7)" }} />
            </button>
          )}
          <button
            onClick={() => {
              if (dniVerificado === false || !identityVerificado) {
                mostrarToast("Verificá tu identidad en Mi perfil antes de publicar cargas.");
                setNavActivo("Mi perfil");
              } else {
                setModalPublicar(true);
              }
            }}
            title={(dniVerificado === false || !identityVerificado) ? "Verificá tu identidad primero" : undefined}
            style={{ fontSize: 13, padding: "9px 18px", borderRadius: 8, background: (dniVerificado === false || !identityVerificado) ? "#9ca3af" : "#3a806b", border: "none", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ibm-plex), sans-serif" }}
          >
            + Publicar carga
          </button>
          {isMobile && (
            <button onClick={() => setMobileMenuOpen((m) => !m)} style={{ background: "transparent", border: "none", cursor: "pointer", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
              <i className={mobileMenuOpen ? "fa-solid fa-xmark" : "fa-solid fa-bars"} style={{ fontSize: 18, color: darkMode === false ? "#374151" : "rgba(255,255,255,0.8)" }} />
            </button>
          )}
          <button
            onClick={() => setNavActivo("Mi perfil")}
            title="Ver mi perfil"
            style={{ width: 34, height: 34, borderRadius: "50%", background: "#3a806b", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}
          >
            {initials}
          </button>
        </div>
      </header>

      {/* Mobile nav dropdown */}
      {isMobile && mobileMenuOpen && (
        <div style={{ position: "fixed", top: 64, left: 0, right: 0, zIndex: 9, background: darkMode === false ? "#ffffff" : "rgba(10,10,10,0.97)", borderBottom: "1px solid " + (darkMode === false ? "#e5e7eb" : "rgba(255,255,255,0.1)"), paddingBottom: 8 }}>
          {NAV_ITEMS.map(({ item, icon }) => {
            const activo = navActivo === item;
            const badge = item === "Mis cargas" ? cargas.reduce((s, c) => s + c.ofertas, 0) : 0;
            return (
              <button key={item} onClick={() => { setNavActivo(item); setMobileMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "14px 24px", background: activo ? "rgba(58,128,107,0.1)" : "transparent", border: "none", cursor: "pointer", color: activo ? "#3a806b" : darkMode === false ? "#374151" : "rgba(255,255,255,0.75)", fontSize: 15, fontWeight: activo ? 600 : 400, fontFamily: "var(--font-ibm-plex), sans-serif" }}>
                <FontAwesomeIcon icon={icon} style={{ width: 16, height: 16 }} />
                {item}
                {badge > 0 && <span style={{ marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{badge > 9 ? "9+" : badge}</span>}
              </button>
            );
          })}
          <div style={{ borderTop: darkMode === false ? "1px solid #e5e7eb" : "1px solid rgba(255,255,255,0.1)", margin: "8px 0" }} />
          <button
            suppressHydrationWarning
            onClick={() => { toggleDark(); setMobileMenuOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "14px 24px", background: "transparent", border: "none", cursor: "pointer", color: darkMode === false ? "#374151" : "rgba(255,255,255,0.75)", fontSize: 15, fontWeight: 400, fontFamily: "var(--font-ibm-plex), sans-serif" }}
          >
            <FontAwesomeIcon suppressHydrationWarning icon={darkMode ? faSun : faMoon} style={{ width: 16, height: 16 }} />
            {darkMode ? "Modo claro" : "Modo oscuro"}
          </button>
        </div>
      )}

      {/* Contenido */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--page-bg)" }}>
        {navActivo === "Inicio" && <SeccionInicio cargas={cargas} userName={userName} onNavegar={setNavActivo} />}
        {navActivo === "Mis cargas" && (
          <SeccionMisCargas
            cargas={cargas}
            loading={loadingCargas}
            onVerOfertas={(c) => setModalOfertas(c)}
            onToast={mostrarToast}
            onIniciarPago={(sel) => setModalPago(sel)}
            onRefresh={fetchCargas}
            onPublicar={() => {
              if (dniVerificado === false || !identityVerificado) {
                mostrarToast("Verificá tu identidad en Mi perfil antes de publicar cargas.");
                setNavActivo("Mi perfil");
              } else {
                setModalPublicar(true);
              }
            }}
          />
        )}
        {navActivo === "Mis envios" && <SeccionMisEnvios cargas={cargas} onRefresh={fetchCargas} userId={userId} />}
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

      {/* showOnboarding && (
        <DadorOnboardingOverlay
          onFinish={() => { localStorage.setItem("dador-onboarding-done", "1"); setShowOnboarding(false); }}
          onNavegar={setNavActivo}
        />
      ) */}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
