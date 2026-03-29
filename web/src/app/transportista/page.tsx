"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

// ── Tipos ────────────────────────────────────────────────────────────────────

type NavItem = "Buscar cargas" | "Mis ofertas" | "Mis viajes" | "Mensajes" | "Notificaciones" | "Mi flota" | "Mi perfil";
type SortKey = "Mayor precio" | "Menor precio" | "Más cercano" | "Fecha de retiro";

interface ModalOfertaState {
  cargaId: string | number;
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

function Toast({ mensaje, onClose }: { mensaje: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 100, background: "var(--color-text-primary)", color: "#fff", padding: "12px 18px", borderRadius: "var(--border-radius-md)", fontSize: 13, fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 10 }}>
      <span>✓</span> {mensaje}
      <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 16, padding: 0, marginLeft: 4 }}>×</button>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: 24 }}>
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

interface CargaCard {
  id: string | number;
  titulo: string;
  empresa: string;
  hace: string;
  precio: number;
  peso: string;
  camion: string;
  retiro: string;
  distancia: string;
  rating: number;
  viajes: number;
  badge: string | null;
  destacado: boolean;
}

const TRUCK_LABEL: Record<string, string> = {
  camion: "Furgón", semi: "Plataforma", frigorifico: "Refrigerado",
  cisterna: "Cisterna", acoplado: "Granelero", otros: "Otros",
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function dbLoadToCard(load: Record<string, unknown>): CargaCard {
  const tipoCarga = (load.cargo_type as string) ?? "Carga";
  const titulo = `${tipoCarga} — ${load.pickup_city} → ${load.dropoff_city}`;
  const now = new Date();
  const created = new Date(load.created_at as string);
  const diffH = Math.floor((now.getTime() - created.getTime()) / 3600000);
  const hace = diffH > 24 ? `Publicado hace ${Math.floor(diffH / 24)} día${Math.floor(diffH / 24) > 1 ? "s" : ""}` : diffH > 0 ? `Publicado hace ${diffH} hora${diffH > 1 ? "s" : ""}` : "Publicado hace unos minutos";
  const shipper = load.shipper as Record<string, string> | null;
  let distancia = "—";
  const pLat = load.pickup_lat as number | null;
  const pLon = load.pickup_lon as number | null;
  const dLat = load.dropoff_lat as number | null;
  const dLon = load.dropoff_lon as number | null;
  if (pLat != null && pLon != null && dLat != null && dLon != null) {
    const km = Math.round(haversineKm(pLat, pLon, dLat, dLon));
    distancia = `${km.toLocaleString("es-AR")} km`;
  }
  return { id: (load._id ?? load.id) as string, titulo, empresa: shipper?.razon_social ?? "Dador de carga", hace, precio: (load.price_base as number) ?? 0, peso: load.weight_kg ? `${(load.weight_kg as number).toLocaleString("es-AR")} kg` : "—", camion: load.truck_type_required ? (TRUCK_LABEL[load.truck_type_required as string] ?? "Cualquiera") : "Cualquiera", retiro: load.ready_at ? new Date(load.ready_at as string).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—", distancia, rating: 0, viajes: 0, badge: null, destacado: false };
}

function SeccionBuscar({ onOfertar, onAlerta, excluirIds }: { onOfertar: (c: ModalOfertaState) => void; onAlerta: () => void; excluirIds: Set<string | number> }) {
  const [tipos, setTipos] = useState<string[]>([]);
  const [tiposCamion, setTiposCamion] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("Mayor precio");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [distanciaRango, setDistanciaRango] = useState("todos");
  const [precioMin, setPrecioMin] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [ratingMin, setRatingMin] = useState("0");
  const [soloDestacadas, setSoloDestacadas] = useState(false);
  const [cargasDB, setCargasDB] = useState<CargaCard[]>([]);
  const [loadingDB, setLoadingDB] = useState(true);

  useEffect(() => {
    fetch("/api/loads/available").then((r) => r.json()).then((d) => { if (d.loads) setCargasDB(d.loads.map(dbLoadToCard)); }).catch(() => {}).finally(() => setLoadingDB(false));
  }, []);

  const toggleChip = (list: string[], setList: (v: string[]) => void, t: string) => setList(list.includes(t) ? list.filter((x) => x !== t) : [...list, t]);
  const parseKm = (d: string) => parseInt(d.replace(/\./g, "").replace(/[^0-9]/g, "")) || 0;
  const DIST_RANGOS: Record<string, [number, number]> = { todos: [0, Infinity], corta: [0, 500], media: [500, 1200], larga: [1200, 2000], muy_larga: [2000, Infinity] };
  const limpiarFiltros = () => { setTipos([]); setTiposCamion([]); setOrigen(""); setDestino(""); setDistanciaRango("todos"); setPrecioMin(""); setPrecioMax(""); setFechaDesde(""); setRatingMin("0"); setSoloDestacadas(false); };
  const hayFiltros = tipos.length > 0 || tiposCamion.length > 0 || origen || destino || distanciaRango !== "todos" || precioMin || precioMax || fechaDesde || ratingMin !== "0" || soloDestacadas;
  const [minKm, maxKm] = DIST_RANGOS[distanciaRango];
  const todasCargas: CargaCard[] = cargasDB.filter((c) => !excluirIds.has(c.id));
  const cargas = todasCargas.filter((c) => {
    const km = parseKm(c.distancia);
    if (km < minKm || km > maxKm) return false;
    if (precioMin && c.precio < parseInt(precioMin)) return false;
    if (precioMax && c.precio > parseInt(precioMax)) return false;
    if (tipos.length > 0 && !tipos.some((t) => c.titulo.toLowerCase().includes(t.toLowerCase()))) return false;
    if (tiposCamion.length > 0 && !tiposCamion.some((t) => c.camion.toLowerCase().includes(t.toLowerCase()))) return false;
    if (c.rating < parseFloat(ratingMin)) return false;
    if (soloDestacadas && !c.destacado) return false;
    if (origen && !c.titulo.toLowerCase().includes(origen.toLowerCase())) return false;
    if (destino && !c.titulo.toLowerCase().includes(destino.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "Mayor precio") return b.precio - a.precio;
    if (sortBy === "Menor precio") return a.precio - b.precio;
    if (sortBy === "Más cercano") return parseKm(a.distancia) - parseKm(b.distancia);
    return 0;
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", flex: 1 }}>
      <aside style={{ background: "var(--color-background-primary)", borderRight: "0.5px solid var(--color-border-tertiary)", padding: "16px 14px", overflowY: "auto", maxHeight: "calc(100vh - 58px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>Filtros</div>
          {hayFiltros && <button onClick={limpiarFiltros} style={{ fontSize: 12, color: "var(--color-brand-dark)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}>Limpiar todo</button>}
        </div>
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Ruta</div>
          <input value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Origen..." style={{ ...filterInputStyle, marginBottom: 6 }} />
          <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Destino..." style={filterInputStyle} />
        </div>
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Distancia recorrida</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[{ key: "todos", label: "Cualquier distancia" }, { key: "corta", label: "Hasta 500 km" }, { key: "media", label: "500 — 1.200 km" }, { key: "larga", label: "1.200 — 2.000 km" }, { key: "muy_larga", label: "Más de 2.000 km" }].map(({ key, label }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: distanciaRango === key ? "var(--color-brand-dark)" : "var(--color-text-secondary)", fontWeight: distanciaRango === key ? 500 : 400 }}>
                <input type="radio" name="distancia" checked={distanciaRango === key} onChange={() => setDistanciaRango(key)} style={{ accentColor: "var(--color-brand)", cursor: "pointer" }} />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Precio (ARS)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>Mínimo</div><input type="number" value={precioMin} onChange={(e) => setPrecioMin(e.target.value)} placeholder="0" style={filterInputStyle} /></div>
            <div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>Máximo</div><input type="number" value={precioMax} onChange={(e) => setPrecioMax(e.target.value)} placeholder="∞" style={filterInputStyle} /></div>
          </div>
        </div>
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Tipo de carga</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {["Granel", "Refrigerado", "General", "Plataforma", "Peligroso", "Frágil"].map((t) => { const on = tipos.includes(t); return (<button key={t} onClick={() => toggleChip(tipos, setTipos, t)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, cursor: "pointer", border: on ? "0.5px solid var(--color-brand)" : "0.5px solid var(--color-border-secondary)", background: on ? "var(--color-brand-light)" : "transparent", color: on ? "var(--color-brand-dark)" : "var(--color-text-secondary)", fontWeight: on ? 500 : 400 }}>{t}</button>); })}
          </div>
        </div>
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Tipo de camión requerido</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {["Granelero", "Furgón", "Plataforma", "Refrigerado", "Cisterna", "Batea"].map((t) => { const on = tiposCamion.includes(t); return (<button key={t} onClick={() => toggleChip(tiposCamion, setTiposCamion, t)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, cursor: "pointer", border: on ? "0.5px solid var(--color-brand)" : "0.5px solid var(--color-border-secondary)", background: on ? "var(--color-brand-light)" : "transparent", color: on ? "var(--color-brand-dark)" : "var(--color-text-secondary)", fontWeight: on ? 500 : 400 }}>{t}</button>); })}
          </div>
        </div>
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Fecha de retiro desde</div>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={filterInputStyle} />
        </div>
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Calificación mínima del dador</div>
          <select value={ratingMin} onChange={(e) => setRatingMin(e.target.value)} style={{ ...filterInputStyle, cursor: "pointer" }}>
            <option value="0">Cualquier calificación</option>
            <option value="4">4.0 ★ o más</option>
            <option value="4.5">4.5 ★ o más</option>
            <option value="4.8">4.8 ★ o más</option>
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={soloDestacadas} onChange={(e) => setSoloDestacadas(e.target.checked)} style={{ accentColor: "var(--color-brand)", width: 14, height: 14, cursor: "pointer" }} />
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Solo cargas destacadas</span>
          </label>
        </div>
        <button onClick={onAlerta} style={{ width: "100%", fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", background: "var(--color-brand)", border: "none", color: "#fff", cursor: "pointer", fontWeight: 500 }}>Guardar alerta con estos filtros</button>
      </aside>

      <main style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Ordenar por</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={{ fontSize: 13, padding: "5px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: "pointer" }}>
            <option>Mayor precio</option><option>Menor precio</option><option>Más cercano</option><option>Fecha de retiro</option>
          </select>
          <span style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginLeft: "auto" }}>{loadingDB ? "Cargando..." : `${cargas.length} cargas encontradas`}</span>
        </div>
        {cargas.map((c) => {
          const partes = c.titulo.split(" — ");
          const tipoCarga = partes[0];
          const ruta = partes[1] ?? c.titulo;
          const [or, dest] = ruta.split(" → ");
          return (
            <div key={c.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderLeft: c.destacado ? "4px solid var(--color-brand)" : "4px solid transparent", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)" }}>{or}</span>
                    <span style={{ fontSize: 18, color: "var(--color-brand)", fontWeight: 700 }}>→</span>
                    <span style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)" }}>{dest}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{tipoCarga} · {c.empresa} · {c.hace}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-brand-dark)" }}>${c.precio.toLocaleString("es-AR")}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Precio base</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
                {[["Peso", c.peso], ["Camión", c.camion], ["Retiro", c.retiro], ["Distancia", c.distancia]].map(([label, val]) => (
                  <div key={label}><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 1 }}>{label}</div><div style={{ fontSize: 12, color: "var(--color-text-primary)" }}>{val}</div></div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}><Stars value={c.rating} /> {c.rating} · {c.viajes} viajes{c.badge && <span style={{ color: "var(--color-brand-dark)" }}> · {c.badge}</span>}</div>
                <button onClick={(e) => { e.stopPropagation(); onOfertar({ cargaId: c.id, titulo: c.titulo, empresa: c.empresa, precioBase: c.precio }); }} style={{ fontSize: 13, padding: "7px 16px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Ofertar →</button>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}

interface MiOferta { id: string; titulo: string; empresa: string; precioBase: number; miOferta: number; fecha: string; estado: "pending" | "countered" | "accepted" | "rejected"; counterPrice: number | null; nota: string; }

function SeccionMisOfertas({ onToast }: { onToast: (m: string) => void }) {
  const [ofertas, setOfertas] = useState<MiOferta[]>([]);
  const [loading, setLoading] = useState(true);
  const [accionando, setAccionando] = useState<string | null>(null);

  const fetchOfertas = () => { setLoading(true); fetch("/api/offers/mine").then((r) => r.json()).then((d) => { if (d.offers) setOfertas(d.offers); }).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { fetchOfertas(); }, []);

  const accion = async (offerId: string, action: string) => {
    setAccionando(offerId + action);
    try {
      const res = await fetch(`/api/offers/${offerId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (res.ok) { if (action === "withdraw") onToast("Oferta retirada."); else if (action === "accept_counter") onToast("Contraoferta aceptada. ¡El viaje está confirmado!"); else if (action === "reject_counter") onToast("Contraoferta rechazada."); fetchOfertas(); }
    } finally { setAccionando(null); }
  };

  const estadoLabel: Record<string, string> = { pending: "Pendiente", countered: "Contraoferta recibida", accepted: "Aceptada", rejected: "Rechazada" };
  const estadoStyle: Record<string, { bg: string; color: string }> = { pending: { bg: "#fef3c7", color: "#92400e" }, countered: { bg: "#eff6ff", color: "#1d4ed8" }, accepted: { bg: "var(--color-brand-light)", color: "var(--color-brand-dark)" }, rejected: { bg: "#fee2e2", color: "#b91c1c" } };

  return (
    <main style={{ padding: 20, flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 16 }}>Mis ofertas</div>
      {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
      {!loading && ofertas.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>No enviaste ofertas todavía.</div>}
      {!loading && ofertas.map((o) => (
        <div key={o.id} style={{ background: "var(--color-background-primary)", border: o.estado === "countered" ? "1.5px solid #3b82f6" : "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div><div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{o.titulo}</div><div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{o.empresa} · {o.fecha}</div></div>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: estadoStyle[o.estado]?.bg, color: estadoStyle[o.estado]?.color }}>{estadoLabel[o.estado]}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
            <div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>Precio base del dador</div><div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{o.precioBase ? `$${o.precioBase.toLocaleString("es-AR")}` : "—"}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>Tu oferta</div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-brand-dark)" }}>${o.miOferta.toLocaleString("es-AR")}</div></div>
          </div>
          {o.estado === "countered" && o.counterPrice != null && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "#eff6ff", borderRadius: "var(--border-radius-md)", border: "1px solid #bfdbfe" }}>
              <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 600, marginBottom: 8 }}>El dador propuso un nuevo precio: <span style={{ fontSize: 15 }}>${o.counterPrice.toLocaleString("es-AR")}</span></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => accion(o.id, "accept_counter")} disabled={accionando === o.id + "accept_counter"} style={{ flex: 1, padding: "8px 0", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: accionando === o.id + "accept_counter" ? 0.6 : 1 }}>Aceptar contraoferta</button>
                <button onClick={() => accion(o.id, "reject_counter")} disabled={accionando === o.id + "reject_counter"} style={{ flex: 1, padding: "8px 0", borderRadius: "var(--border-radius-md)", border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: accionando === o.id + "reject_counter" ? 0.6 : 1 }}>Rechazar</button>
              </div>
            </div>
          )}
          {o.nota && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 10, padding: "8px 10px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)" }}>&ldquo;{o.nota}&rdquo;</div>}
          {(o.estado === "pending" || o.estado === "countered") && (
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => accion(o.id, "withdraw")} disabled={accionando === o.id + "withdraw"} style={{ fontSize: 12, padding: "5px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "none", color: "var(--color-text-tertiary)", cursor: "pointer", opacity: accionando === o.id + "withdraw" ? 0.5 : 1 }}>Retirar oferta</button>
            </div>
          )}
        </div>
      ))}
    </main>
  );
}

type TabViajes = "En curso" | "Próximos" | "Completados";

interface TripData { offerId: string; loadId: string; titulo: string; empresa: string; precio: number; fechaRetiro: string; pickupCity: string; dropoffCity: string; pickupExact: string | null; dropoffExact: string | null; status: string; yaCalifiqué: boolean; }

function ModalCalificarDador({ offerId, empresa, onClose }: { offerId: string; empresa: string; onClose: () => void }) {
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [done, setDone] = useState(false);
  const enviar = async () => { if (!score) return; setEnviando(true); try { await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId, score }) }); setDone(true); } finally { setEnviando(false); } };
  if (done) return (<Modal title="¡Gracias por calificar!" onClose={onClose}><div style={{ textAlign: "center", padding: "28px 20px" }}><div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div><div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>Calificación enviada</div><div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>Tu opinión ayuda a la comunidad de CargaBack.</div><button onClick={onClose} style={{ fontSize: 14, padding: "10px 28px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Cerrar</button></div></Modal>);
  return (
    <Modal title={`Calificá a ${empresa}`} onClose={onClose}>
      <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>¿Cómo fue tu experiencia con este dador de carga?</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map((s) => (<button key={s} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => setScore(s)} style={{ fontSize: 36, background: "none", border: "none", cursor: "pointer", color: s <= (hover || score) ? "#BA7517" : "var(--color-border-secondary)", transition: "color 0.1s", padding: "0 2px" }}>★</button>))}
        </div>
        {score > 0 && <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>{["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"][score]}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>Omitir</button>
          <button onClick={enviar} disabled={!score || enviando} style={{ flex: 2, fontSize: 13, padding: "10px", borderRadius: "var(--border-radius-md)", border: "none", background: score ? "var(--color-brand)" : "var(--color-background-secondary)", color: score ? "#fff" : "var(--color-text-tertiary)", cursor: score ? "pointer" : "not-allowed", fontWeight: 600 }}>{enviando ? "Enviando..." : "Enviar calificación"}</button>
        </div>
      </div>
    </Modal>
  );
}

function Calendario({ eventos }: { eventos: { fecha: string; tipo: "salida" | "llegada"; titulo: string }[] }) {
  const [base, setBase] = useState(() => new Date(2026, 3, 1));
  const year = base.getFullYear(); const month = base.getMonth();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const eventMap: Record<number, { tipo: "salida" | "llegada"; titulo: string }[]> = {};
  eventos.forEach(({ fecha, tipo, titulo }) => { const [d, m, y] = fecha.split("/").map(Number); if (m - 1 === month && y === year) { if (!eventMap[d]) eventMap[d] = []; eventMap[d].push({ tipo, titulo }); } });
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => setBase(new Date(year, month - 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--color-text-secondary)", padding: "2px 6px" }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{MESES[month]} {year}</span>
        <button onClick={() => setBase(new Date(year, month + 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--color-text-secondary)", padding: "2px 6px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
        {["Lu","Ma","Mi","Ju","Vi","Sa","Do"].map((d) => (<div key={d} style={{ textAlign: "center", fontSize: 11, color: "var(--color-text-tertiary)", fontWeight: 500, padding: "2px 0" }}>{d}</div>))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {cells.map((day, i) => { const evs = day ? eventMap[day] : null; const hasSalida = evs?.some((e) => e.tipo === "salida"); const hasLlegada = evs?.some((e) => e.tipo === "llegada"); return (<div key={i} title={evs?.map((e) => `${e.tipo === "salida" ? "Salida" : "Llegada"}: ${e.titulo}`).join("\n")} style={{ height: 34, borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: evs ? "var(--color-brand-light)" : "transparent", border: evs ? "0.5px solid var(--color-brand)" : "none", cursor: evs ? "pointer" : "default" }}>{day && <span style={{ fontSize: 12, fontWeight: evs ? 600 : 400, color: evs ? "var(--color-brand-dark)" : "var(--color-text-secondary)" }}>{day}</span>}{(hasSalida || hasLlegada) && (<div style={{ display: "flex", gap: 2, marginTop: 1 }}>{hasSalida && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-brand)" }} />}{hasLlegada && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#3b82f6" }} />}</div>)}</div>); })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 14, paddingTop: 12, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-text-tertiary)" }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-brand)" }} /> Salida</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-text-tertiary)" }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6" }} /> Llegada</div>
      </div>
    </div>
  );
}

function SeccionMisViajes() {
  const [tab, setTab] = useState<TabViajes>("En curso");
  const [trips, setTrips] = useState<{ enCurso: TripData[]; proximos: TripData[]; completados: TripData[] }>({ enCurso: [], proximos: [], completados: [] });
  const [loading, setLoading] = useState(true);
  const [modalCalificar, setModalCalificar] = useState<{ offerId: string; empresa: string } | null>(null);
  const [calificados, setCalificados] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/trips/mine").then((r) => r.json()).then((d) => {
      setTrips({ enCurso: d.enCurso ?? [], proximos: d.proximos ?? [], completados: d.completados ?? [] });
      const alreadyRated = new Set<string>((d.completados ?? []).filter((t: TripData) => t.yaCalifiqué).map((t: TripData) => t.offerId));
      setCalificados(alreadyRated);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const tabData = { "En curso": trips.enCurso, "Próximos": trips.proximos, "Completados": trips.completados };
  const current = tabData[tab];

  const TripCard = ({ t }: { t: TripData }) => {
    const partes = t.titulo.split(" — "); const tipoCarga = partes[0]; const ruta = partes[1] ?? t.titulo; const [or, dest] = ruta.split(" → ");
    const completado = t.status === "delivered"; const yaCalif = calificados.has(t.offerId);
    const retiroExacto = t.pickupExact && t.pickupExact !== t.pickupCity ? t.pickupExact : null;
    const entregaExacta = t.dropoffExact && t.dropoffExact !== t.dropoffCity ? t.dropoffExact : null;
    return (
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderLeft: `4px solid ${completado ? "#16a34a" : tab === "En curso" ? "#f59e0b" : "#3b82f6"}`, borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>{or}</span>
              <span style={{ fontSize: 15, color: "var(--color-brand)", fontWeight: 700 }}>→</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>{dest}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{tipoCarga} · {t.empresa}</div>
          </div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-brand-dark)" }}>${t.precio.toLocaleString("es-AR")}</div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Retiro: {t.fechaRetiro}</div></div>
        </div>
        {(retiroExacto || entregaExacta) && (<div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 8, display: "flex", flexDirection: "column", gap: 4 }}>{retiroExacto && <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>📍 <strong>Retiro:</strong> {retiroExacto}</div>}{entregaExacta && <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>📍 <strong>Entrega:</strong> {entregaExacta}</div>}</div>)}
        {completado && (<div style={{ marginTop: 8, paddingTop: 8, borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", justifyContent: "flex-end" }}>{yaCalif ? (<span style={{ fontSize: 12, color: "var(--color-text-tertiary)", padding: "6px 12px" }}>✓ Ya calificaste este viaje</span>) : (<button onClick={() => setModalCalificar({ offerId: t.offerId, empresa: t.empresa })} style={{ fontSize: 12, padding: "7px 16px", borderRadius: "var(--border-radius-md)", border: "none", background: "#BA7517", color: "#fff", fontWeight: 600, cursor: "pointer" }}>⭐ Calificar dador</button>)}</div>)}
      </div>
    );
  };

  return (
    <main style={{ padding: "20px 24px", flex: 1 }}>
      {modalCalificar && <ModalCalificarDador offerId={modalCalificar.offerId} empresa={modalCalificar.empresa} onClose={() => { setCalificados((prev) => new Set([...prev, modalCalificar.offerId])); setModalCalificar(null); }} />}
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 16 }}>Mis viajes</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        {([{ t: "En curso" as TabViajes, icon: "🚛", color: "#f59e0b", bg: "#fffbeb", count: trips.enCurso.length, desc: "Viaje activo ahora" }, { t: "Próximos" as TabViajes, icon: "📅", color: "#3b82f6", bg: "#eff6ff", count: trips.proximos.length, desc: "Confirmados" }, { t: "Completados" as TabViajes, icon: "✓", color: "#16a34a", bg: "#f0fdf4", count: trips.completados.length, desc: "Historial" }]).map(({ t, icon, color, bg, count, desc }) => (<button key={t} onClick={() => setTab(t)} style={{ border: tab === t ? `2px solid ${color}` : "1.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", background: tab === t ? bg : "var(--color-background-primary)", padding: "18px 20px", cursor: "pointer", textAlign: "left" as const, transition: "all 0.15s", boxShadow: tab === t ? `0 2px 12px ${color}33` : "none" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><div style={{ width: 40, height: 40, borderRadius: "var(--border-radius-md)", background: tab === t ? color : "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transition: "all 0.15s" }}>{icon}</div><span style={{ fontSize: 30, fontWeight: 700, color: tab === t ? color : "var(--color-text-primary)", lineHeight: 1 }}>{count}</span></div><div style={{ fontSize: 15, fontWeight: 600, color: tab === t ? color : "var(--color-text-primary)", marginBottom: 3 }}>{t}</div><div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{desc}</div></button>))}
      </div>
      {loading && <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
          <div>{current.length === 0 ? (<div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14, background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}>No tenés viajes en esta categoría todavía.</div>) : (current.map((t) => <TripCard key={t.offerId} t={t} />))}</div>
          <Calendario eventos={[]} />
        </div>
      )}
    </main>
  );
}

interface Conversacion { offerId: string; cargaTitulo: string; otherUserName: string; precio: number; lastMessage: string | null; lastMessageTime: string | null; }
interface MensajeChat { id: string; senderId: string; texto: string; hora: string; }

function Chat({ conv, userId, onVolver }: { conv: Conversacion; userId: string; onVolver: () => void }) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/messages?offerId=${conv.offerId}`).then((r) => r.json()).then((d) => { if (d.messages) { setMensajes(d.messages.map((m: { id: string; senderId: string; content: string; hora: string }) => ({ id: m.id, senderId: m.senderId, texto: m.content, hora: m.hora }))); setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50); } }).catch(() => {});
  }, [conv.offerId]);

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId: conv.offerId, content: texto.trim() }) });
      if (res.ok) { const data = await res.json(); const m = data.message; setMensajes((prev) => [...prev, { id: m.id, senderId: m.senderId, texto: m.content, hora: m.hora }]); setTexto(""); setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50); }
    } finally { setEnviando(false); }
  };

  return (
    <main style={{ padding: "28px 32px", flex: 1, maxWidth: 760 }}>
      <button onClick={onVolver} style={{ fontSize: 13, color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer", marginBottom: 16, padding: 0 }}>← Volver a mensajes</button>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>{conv.otherUserName}</div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>{conv.cargaTitulo} · ${conv.precio.toLocaleString("es-AR")}</div>
      <div style={{ background: "var(--color-brand-light)", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "var(--color-brand-dark)", fontWeight: 500 }}>🚛 {conv.cargaTitulo} · ${conv.precio.toLocaleString("es-AR")} · Pago en escrow</div>
      <div ref={listRef} style={{ height: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 14, paddingRight: 4 }}>
        {mensajes.length === 0 && <div style={{ textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13, marginTop: 80 }}>Sin mensajes todavía. ¡Iniciá la conversación!</div>}
        {mensajes.map((m) => { const esYo = m.senderId === userId; return (<div key={m.id} style={{ display: "flex", justifyContent: esYo ? "flex-end" : "flex-start" }}><div style={{ maxWidth: "75%", padding: "9px 13px", borderRadius: esYo ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: esYo ? "var(--color-brand)" : "var(--color-background-secondary)", color: esYo ? "#fff" : "var(--color-text-primary)", fontSize: 13, lineHeight: 1.5 }}>{m.texto}<div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: "right" }}>{m.hora}</div></div></div>); })}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} placeholder="Escribí un mensaje..." style={{ flex: 1, fontSize: 13, padding: "9px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" }} />
        <button onClick={enviar} disabled={enviando} style={{ padding: "9px 16px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: enviando ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14, opacity: enviando ? 0.7 : 1 }}>→</button>
      </div>
    </main>
  );
}

function SeccionMensajes({ userId }: { userId: string }) {
  const [convs, setConvs] = useState<Conversacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatAbierto, setChatAbierto] = useState<Conversacion | null>(null);

  useEffect(() => { fetch("/api/conversations").then((r) => r.json()).then((d) => { if (d.conversations) setConvs(d.conversations); }).catch(() => {}).finally(() => setLoading(false)); }, []);

  if (chatAbierto) return <Chat conv={chatAbierto} userId={userId} onVolver={() => setChatAbierto(null)} />;
  return (
    <main style={{ padding: "28px 32px", flex: 1, maxWidth: 760 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 20 }}>Mensajes</div>
      {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
      {!loading && convs.length === 0 && (<div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-text-tertiary)", fontSize: 14, background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}><div style={{ fontSize: 36, marginBottom: 12 }}>✉</div><div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>No tenés mensajes todavía</div><div>Los chats con dadores de carga aparecerán aquí una vez que se acepte una oferta.</div></div>)}
      {!loading && convs.map((c) => (<button key={c.offerId} onClick={() => setChatAbierto(c)} style={{ width: "100%", textAlign: "left", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "14px 16px", marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}><div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "var(--color-brand-dark)", flexShrink: 0 }}>{c.otherUserName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}><div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{c.otherUserName}</div>{c.lastMessageTime && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{c.lastMessageTime}</div>}</div><div style={{ fontSize: 12, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.cargaTitulo}</div>{c.lastMessage && <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{c.lastMessage}</div>}</div></button>))}
    </main>
  );
}

function SeccionNotificaciones() {
  return (
    <main style={{ padding: "28px 32px", flex: 1, maxWidth: 760 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 20 }}>Notificaciones</div>
      <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-text-tertiary)", fontSize: 14, background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}><div style={{ fontSize: 32, marginBottom: 10 }}>🔔</div><div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>No tenés notificaciones</div><div>Las notificaciones de ofertas, pagos y viajes aparecerán aquí.</div></div>
    </main>
  );
}

// ── Mi Flota ──────────────────────────────────────────────────────────────────

interface Driver { _id: string; name: string; email: string; phone?: string; dni?: string; }
interface TruckData { _id: string; patente: string; marca?: string; modelo?: string; año?: number; truck_type?: string; capacity_kg?: number; vtv_vence?: string; seguro_poliza?: string; seguro_vence?: string; }

const TIPO_CAMION = ["camion", "semi", "acoplado", "frigorifico", "cisterna", "batea", "otros"] as const;
const REQUIERE_REMOLQUE = new Set(["semi", "acoplado", "batea"]);

function ModalAgregarCamion({ onClose, onAdded }: { onClose: () => void; onAdded: (t: TruckData) => void }) {
  const [patente, setPatente] = useState("");
  const [patenteRemolque, setPatenteRemolque] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [año, setAño] = useState("");
  const [tipo, setTipo] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const [vtvVence, setVtvVence] = useState("");
  const [seguroPoliza, setSeguroPoliza] = useState("");
  const [seguroVence, setSeguroVence] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!patente.trim()) { setError("La patente es obligatoria."); return; }
    if (!/^[A-Za-z0-9]{6,7}$/.test(patente.replace(/\s/g, ""))) { setError("Patente inválida (ej: AB123CD)."); return; }
    if (!tipo) { setError("Seleccioná el tipo de camión."); return; }
    if (REQUIERE_REMOLQUE.has(tipo) && !patenteRemolque.trim()) { setError(`Los ${tipo}s necesitan la patente del remolque.`); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/fleet/trucks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patente: patente.toUpperCase(), patente_remolque: patenteRemolque || undefined, marca, modelo, año, truck_type: tipo, capacity_kg: capacidad || undefined, vtv_vence: vtvVence || undefined, seguro_poliza: seguroPoliza || undefined, seguro_vence: seguroVence || undefined }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al agregar el camión."); return; }
      onAdded(data.truck);
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Agregar camión" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <FormCampo label="Patente" value={patente} onChange={(v) => setPatente(v.toUpperCase())} placeholder="AB123CD" required />
          <FormCampo label="Año" value={año} onChange={setAño} placeholder="2018" type="number" />
          <FormCampo label="Marca" value={marca} onChange={setMarca} placeholder="Mercedes-Benz" />
          <FormCampo label="Modelo" value={modelo} onChange={setModelo} placeholder="Actros 2651" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={formLabelStyle}>Tipo de camión<span style={{ color: "#ef4444", marginLeft: 2 }}>*</span></label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...formInputStyle, appearance: "none" as React.CSSProperties["appearance"] }}>
            <option value="">Seleccioná un tipo</option>
            {TIPO_CAMION.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        {REQUIERE_REMOLQUE.has(tipo) && (
          <FormCampo label="Patente del remolque / acoplado" value={patenteRemolque} onChange={(v) => setPatenteRemolque(v.toUpperCase())} placeholder="AB123CD" required />
        )}
        <FormCampo label="Capacidad (kg)" value={capacidad} onChange={setCapacidad} placeholder="20000" type="number" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <FormCampo label="VTV — vencimiento" value={vtvVence} onChange={setVtvVence} type="date" />
          <FormCampo label="N° póliza de seguro" value={seguroPoliza} onChange={setSeguroPoliza} placeholder="POL-123456" />
        </div>
        <FormCampo label="Seguro — vencimiento" value={seguroVence} onChange={setSeguroVence} type="date" />
        {error && <div style={{ fontSize: 13, color: "#b91c1c", background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>Cancelar</button>
          <button type="submit" disabled={loading} style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: 8, border: "none", background: loading ? "#aaa" : "var(--color-brand)", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}>{loading ? "Guardando..." : "Agregar camión"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ModalAgregarConductor({ onClose, onAdded }: { onClose: () => void; onAdded: (d: Driver) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!name.trim() || !email.trim() || !password.trim()) { setError("Nombre, email y contraseña son obligatorios."); return; }
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/fleet/drivers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, phone: phone || undefined, dni: dni || undefined, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al agregar el conductor."); return; }
      onAdded(data.driver);
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Agregar conductor" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <FormCampo label="Nombre y apellido" value={name} onChange={setName} placeholder="Juan Rodríguez" required />
        <FormCampo label="Email" value={email} onChange={setEmail} placeholder="conductor@email.com" type="email" required />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <FormCampo label="Celular" value={phone} onChange={setPhone} placeholder="+54 9 11 1234-5678" />
          <FormCampo label="DNI" value={dni} onChange={(v) => setDni(v.replace(/\D/g, ""))} placeholder="12345678" />
        </div>
        <FormCampo label="Contraseña inicial" value={password} onChange={setPassword} placeholder="Mínimo 8 caracteres" type="password" required />
        <div style={{ background: "#fef3c7", border: "0.5px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.5 }}>El conductor va a poder iniciar sesión con este email y contraseña. Compartíselos de forma segura.</p>
        </div>
        {error && <div style={{ fontSize: 13, color: "#b91c1c", background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>Cancelar</button>
          <button type="submit" disabled={loading} style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: 8, border: "none", background: loading ? "#aaa" : "var(--color-brand)", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}>{loading ? "Guardando..." : "Agregar conductor"}</button>
        </div>
      </form>
    </Modal>
  );
}

function SeccionMiFlota() {
  const [tabFlota, setTabFlota] = useState<"Camiones" | "Conductores">("Camiones");
  const [trucks, setTrucks] = useState<TruckData[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingTrucks, setLoadingTrucks] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [modalCamion, setModalCamion] = useState(false);
  const [modalConductor, setModalConductor] = useState(false);

  useEffect(() => {
    fetch("/api/fleet/trucks").then((r) => r.json()).then((d) => { if (d.trucks) setTrucks(d.trucks); }).catch(() => {}).finally(() => setLoadingTrucks(false));
    fetch("/api/fleet/drivers").then((r) => r.json()).then((d) => { if (d.drivers) setDrivers(d.drivers); }).catch(() => {}).finally(() => setLoadingDrivers(false));
  }, []);

  return (
    <main style={{ padding: "20px 24px", flex: 1, maxWidth: 900 }}>
      {modalCamion && <ModalAgregarCamion onClose={() => setModalCamion(false)} onAdded={(t) => setTrucks((prev) => [...prev, t])} />}
      {modalConductor && <ModalAgregarConductor onClose={() => setModalConductor(false)} onAdded={(d) => setDrivers((prev) => [...prev, d])} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)" }}>Mi flota</div>
        <button
          onClick={() => tabFlota === "Camiones" ? setModalCamion(true) : setModalConductor(true)}
          style={{ fontSize: 13, padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
          + Agregar {tabFlota === "Camiones" ? "camión" : "conductor"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "inline-flex", background: "var(--color-background-secondary)", borderRadius: 8, padding: 3, gap: 2, marginBottom: 20 }}>
        {(["Camiones", "Conductores"] as const).map((t) => (
          <button key={t} onClick={() => setTabFlota(t)} style={{ fontSize: 14, padding: "8px 20px", borderRadius: 6, border: "none", cursor: "pointer", background: tabFlota === t ? "var(--color-background-primary)" : "transparent", color: tabFlota === t ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: tabFlota === t ? 600 : 400, boxShadow: tabFlota === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>{t}</button>
        ))}
      </div>

      {/* Camiones */}
      {tabFlota === "Camiones" && (
        <>
          {loadingTrucks && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
          {!loadingTrucks && trucks.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🚛</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>No tenés camiones registrados</div>
              <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginBottom: 20 }}>Agregá tus camiones para poder recibir y aceptar cargas.</div>
              <button onClick={() => setModalCamion(true)} style={{ fontSize: 13, padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>+ Agregar primer camión</button>
            </div>
          )}
          {!loadingTrucks && trucks.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 16 }}>
              {trucks.map((t) => (
                <div key={t._id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🚛</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>{t.patente}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{[t.marca, t.modelo, t.año].filter(Boolean).join(" ") || "Sin datos"}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[["Tipo", t.truck_type ?? "—"], ["Capacidad", t.capacity_kg ? `${t.capacity_kg.toLocaleString("es-AR")} kg` : "—"], ["VTV vence", t.vtv_vence ?? "—"], ["Seguro vence", t.seguro_vence ?? "—"]].map(([label, val]) => (
                      <div key={label}><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>{label}</div><div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{val}</div></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Conductores */}
      {tabFlota === "Conductores" && (
        <>
          {loadingDrivers && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
          {!loadingDrivers && drivers.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👷</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>No tenés conductores agregados</div>
              <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginBottom: 20 }}>Agregá conductores para que puedan operar los camiones de tu flota.</div>
              <button onClick={() => setModalConductor(true)} style={{ fontSize: 13, padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>+ Agregar primer conductor</button>
            </div>
          )}
          {!loadingDrivers && drivers.length > 0 && (
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    {["Nombre", "DNI", "Email", "Teléfono"].map((h) => (<th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d, i) => (
                    <tr key={d._id} style={{ borderBottom: i < drivers.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--color-brand-dark)", flexShrink: 0 }}>{d.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}</div>
                          {d.name}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{d.dni ?? "—"}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{d.email}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{d.phone ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}

// ── Perfil ────────────────────────────────────────────────────────────────────

type TabPerfil = "Perfil" | "Estadísticas";
interface EarningsMes { mes: string; monto: number; }
interface TipoCargaStat { tipo: string; pct: number; count: number; color: string; }
interface RutaStat { ruta: string; viajes: number; }
interface TransportistaStats { viajesCompletados: number; calificacionPromedio: number | null; memberSince: string; ingresosUltimos6Meses: EarningsMes[]; tiposCarga: TipoCargaStat[]; rutasFrecuentes: RutaStat[]; totalIngresos6m: number; viajes6m: number; }

function SeccionPerfil({ onToast, userName, userEmail }: { onToast: (m: string) => void; userName: string; userEmail: string; }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(userName);
  const [telefono, setTelefono] = useState("");
  const [tabPerfil, setTabPerfil] = useState<TabPerfil>("Perfil");
  const [stats, setStats] = useState<TransportistaStats | null>(null);
  const initials = nombre.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";

  useEffect(() => { fetch("/api/stats/camionero").then((r) => r.json()).then((d) => setStats(d)).catch(() => {}); }, []);

  return (
    <main style={{ flex: 1, background: "var(--color-background-tertiary)" }}>
      <div style={{ background: "linear-gradient(135deg, #16301a 0%, #1e4a24 100%)", padding: "36px 40px 52px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24, maxWidth: 800 }}>
          <div style={{ width: 84, height: 84, borderRadius: "50%", background: "var(--color-brand)", border: "3px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1 }}>
            {editando ? <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ fontSize: 24, fontWeight: 700, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "var(--border-radius-md)", padding: "4px 10px", color: "#fff", outline: "none", width: "100%", maxWidth: 300 }} /> : <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{nombre}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Transportista</span>
              <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 500 }}>✓ Verificado</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{userEmail}</div>
          </div>
          {tabPerfil === "Perfil" && <button onClick={() => { if (editando) onToast("Perfil actualizado."); setEditando(!editando); }} style={{ fontSize: 13, padding: "9px 18px", borderRadius: "var(--border-radius-md)", background: editando ? "var(--color-brand)" : "rgba(255,255,255,0.12)", border: editando ? "none" : "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontWeight: 500, flexShrink: 0 }}>{editando ? "Guardar cambios" : "Editar perfil"}</button>}
        </div>
      </div>

      <div style={{ padding: "0 40px", marginTop: -28, maxWidth: 840 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          {[[stats?.calificacionPromedio != null ? `${stats.calificacionPromedio} ⭐` : "— ⭐", "Calificación promedio"], [stats ? String(stats.viajesCompletados) : "—", "Viajes completados"], [stats?.memberSince ?? "—", "En plataforma desde"]].map(([val, label], idx, arr) => (<div key={label} style={{ padding: "20px 0", textAlign: "center", borderRight: idx < arr.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}><div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)" }}>{val}</div><div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 4 }}>{label}</div></div>))}
        </div>
      </div>

      <div style={{ padding: "22px 40px 0", maxWidth: 840 }}>
        <div style={{ display: "inline-flex", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: 3, gap: 2 }}>
          {(["Perfil", "Estadísticas"] as TabPerfil[]).map((t) => (<button key={t} onClick={() => setTabPerfil(t)} style={{ fontSize: 14, padding: "8px 22px", borderRadius: "var(--border-radius-md)", border: "none", cursor: "pointer", background: tabPerfil === t ? "var(--color-background-primary)" : "transparent", color: tabPerfil === t ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: tabPerfil === t ? 600 : 400, boxShadow: tabPerfil === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>{t}</button>))}
        </div>
      </div>

      {tabPerfil === "Perfil" && (
        <div style={{ padding: "20px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 840 }}>
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>📋</span> Contacto</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Teléfono</div>{editando ? <input value={telefono} onChange={(e) => setTelefono(e.target.value)} style={{ fontSize: 14, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", padding: "7px 10px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", width: "100%", boxSizing: "border-box" as const }} /> : <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{telefono || "—"}</div>}</div>
              <div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Email</div><div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{userEmail || "—"}</div></div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 24, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 12 }}>Mi flota</div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Gestioná tus camiones y conductores desde la sección <strong>Mi flota</strong> en el menú.</div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/" })} style={{ fontSize: 13, padding: "12px", borderRadius: "var(--border-radius-lg)", border: "0.5px solid #fecaca", background: "#fef2f2", color: "#b91c1c", cursor: "pointer", fontWeight: 500 }}>Cerrar sesión</button>
          </div>
        </div>
      )}

      {tabPerfil === "Estadísticas" && (
        <div style={{ padding: "20px 40px 32px", maxWidth: 840 }}>
          {!stats && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando estadísticas...</div>}
          {stats && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                {[{ val: stats.totalIngresos6m > 0 ? `$${stats.totalIngresos6m.toLocaleString("es-AR")}` : "Sin datos", label: "Ingresos últimos 6 meses", color: "#16a34a" }, { val: stats.viajes6m > 0 ? `${stats.viajes6m} viaje${stats.viajes6m !== 1 ? "s" : ""}` : "Sin datos", label: "Viajes últimos 6 meses", color: "#8b5cf6" }, { val: stats.viajes6m > 0 ? `$${Math.round(stats.totalIngresos6m / stats.viajes6m).toLocaleString("es-AR")}` : "—", label: "Ingreso promedio / viaje", color: "#f59e0b" }].map(({ val, label, color }) => (<div key={label} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px 18px" }}><div style={{ fontSize: 18, fontWeight: 700, color, marginBottom: 4 }}>{val}</div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", lineHeight: 1.4 }}>{label}</div></div>))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 18 }}>Ingresos mensuales</div>
                  {stats.ingresosUltimos6Meses.every((e) => e.monto === 0) ? (<div style={{ textAlign: "center", padding: "24px 0", color: "var(--color-text-tertiary)", fontSize: 13 }}>Todavía no hay ingresos registrados.</div>) : (() => { const maxE = Math.max(...stats.ingresosUltimos6Meses.map((e) => e.monto), 1); return (<div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 110 }}>{stats.ingresosUltimos6Meses.map((e) => { const hPct = (e.monto / maxE) * 100; const isMax = e.monto === maxE && e.monto > 0; return (<div key={e.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>{e.monto > 0 && <div style={{ fontSize: 10, color: isMax ? "var(--color-brand-dark)" : "var(--color-text-tertiary)", fontWeight: isMax ? 700 : 400 }}>${(e.monto / 1000).toFixed(0)}k</div>}<div style={{ width: "100%", height: `${Math.max(hPct, 2)}%`, background: isMax ? "var(--color-brand)" : e.monto > 0 ? "var(--color-brand-light)" : "var(--color-background-secondary)", borderRadius: "4px 4px 0 0" }} /><div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{e.mes}</div></div>); })}</div>); })()}
                </div>
                <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 18 }}>Tipos de carga transportada</div>
                  {stats.tiposCarga.length === 0 ? (<div style={{ textAlign: "center", padding: "24px 0", color: "var(--color-text-tertiary)", fontSize: 13 }}>Sin viajes completados todavía.</div>) : (<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{stats.tiposCarga.map((c) => (<div key={c.tipo}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{c.tipo}</span><span style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{c.pct}%</span></div><div style={{ height: 8, background: "var(--color-background-secondary)", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${c.pct}%`, background: c.color, borderRadius: 4 }} /></div></div>))}</div>)}
                </div>
              </div>
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>Rutas más frecuentes</div>
                {stats.rutasFrecuentes.length === 0 ? (<div style={{ textAlign: "center", padding: "24px 0", color: "var(--color-text-tertiary)", fontSize: 13 }}>Sin rutas completadas todavía.</div>) : (<div style={{ display: "flex", flexDirection: "column", gap: 0 }}>{stats.rutasFrecuentes.map((r, i) => (<div key={r.ruta} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < stats.rutasFrecuentes.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-brand-light)", color: "var(--color-brand-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{r.ruta}</div></div><div style={{ textAlign: "right" }}><div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-brand-dark)" }}>{r.viajes}</div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>viaje{r.viajes !== 1 ? "s" : ""}</div></div><div style={{ width: 80, height: 6, background: "var(--color-background-secondary)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${(r.viajes / stats.rutasFrecuentes[0].viajes) * 100}%`, background: "var(--color-brand)", borderRadius: 3 }} /></div></div>))}</div>)}
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}

// ── Modal Ofertar ─────────────────────────────────────────────────────────────

function ModalOfertar({ info, onClose, onEnviar }: { info: ModalOfertaState; onClose: () => void; onEnviar: (cargaId: string | number) => void }) {
  const [precio, setPrecio] = useState(info.precioBase.toString());
  const [nota, setNota] = useState("");
  const [disponible, setDisponible] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const diferencia = parseInt(precio || "0") - info.precioBase;
  const diff = isNaN(diferencia) ? 0 : diferencia;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      const res = await fetch("/api/offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loadId: info.cargaId, price: precio, note: [nota, disponible].filter(Boolean).join(" — ") || undefined }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al enviar la oferta."); return; }
      onEnviar(info.cargaId); onClose();
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Hacer una oferta" onClose={onClose}>
      <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 12px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{info.titulo}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{info.empresa}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 6 }}>Precio base del dador: <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>${info.precioBase.toLocaleString("es-AR")}</span></div>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>Tu precio ofertado (ARS)</label>
          <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0" required style={{ width: "100%", fontSize: 20, fontWeight: 600, padding: "10px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" }} />
          {precio && <div style={{ fontSize: 12, marginTop: 6, color: diff > 0 ? "#b91c1c" : diff < 0 ? "var(--color-brand-dark)" : "var(--color-text-tertiary)" }}>{diff === 0 ? "Igual al precio base" : diff > 0 ? `$${diff.toLocaleString("es-AR")} por encima del precio base` : `$${Math.abs(diff).toLocaleString("es-AR")} por debajo del precio base`}</div>}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>Disponibilidad de salida</label>
          <input type="text" value={disponible} onChange={(e) => setDisponible(e.target.value)} placeholder="ej: Disponible el 28/03 a partir de las 8hs" style={{ width: "100%", fontSize: 13, padding: "9px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>Nota para el dador (opcional)</label>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} placeholder="Contale algo sobre tu experiencia con este tipo de carga..." style={{ width: "100%", fontSize: 13, padding: "9px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>
        {error && <div style={{ fontSize: 13, color: "#b91c1c", background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>Cancelar</button>
          <button type="submit" disabled={loading} style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "none", background: loading ? "#aaa" : "var(--color-brand)", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}>{loading ? "Enviando..." : "Enviar oferta →"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function TransportistaDashboard() {
  const { data: session } = useSession();
  const [navActivo, setNavActivo] = useState<NavItem>("Buscar cargas");
  const [modalOferta, setModalOferta] = useState<ModalOfertaState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ofertadasIds, setOfertadasIds] = useState<Set<string | number>>(new Set());

  const userName  = session?.user?.name  ?? "Usuario";
  const userEmail = session?.user?.email ?? "";
  const userId    = session?.user?.id    ?? "";
  const initials  = userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
  const primerNombre = userName.split(" ")[0];
  const [ofertasBadge, setOfertasBadge] = useState(0);

  useEffect(() => {
    fetch("/api/offers/mine").then((r) => r.json()).then((d) => {
      if (d.offers) setOfertasBadge(d.offers.filter((o: { estado: string }) => o.estado === "pending" || o.estado === "countered").length);
    }).catch(() => {});
  }, []);

  const mostrarToast = (msg: string) => setToast(msg);

  const navItems: NavItem[] = ["Buscar cargas", "Mis ofertas", "Mis viajes", "Mensajes", "Notificaciones", "Mi flota"];

  return (
    <div style={{ background: "var(--color-background-primary)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 58, background: "#16301a", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Link href="/" style={{ fontSize: 18, fontWeight: 700, color: "#fff", textDecoration: "none", letterSpacing: "-0.01em" }}>Carga<span style={{ color: "var(--color-brand)" }}>Back</span></Link>
          <nav style={{ display: "flex", gap: 2 }}>
            {navItems.map((item) => {
              const badge = item === "Mis ofertas" ? ofertasBadge : 0;
              return (
                <button key={item} onClick={() => setNavActivo(item)} style={{ fontSize: 16, padding: "9px 16px", borderRadius: "var(--border-radius-md)", border: "none", cursor: "pointer", position: "relative", background: navActivo === item ? "rgba(255,255,255,0.14)" : "transparent", color: navActivo === item ? "#fff" : "rgba(255,255,255,0.62)", fontWeight: navActivo === item ? 600 : 400, letterSpacing: navActivo === item ? "-0.01em" : "normal" }}>
                  {item}
                  {badge > 0 && <span style={{ position: "absolute", top: 5, right: 5, width: 16, height: 16, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{badge > 9 ? "9+" : badge}</span>}
                </button>
              );
            })}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{primerNombre}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Transportista</span>
          </div>
          <button onClick={() => setNavActivo("Mi perfil")} title="Ver mi perfil" style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-brand)", border: "2px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>{initials}</button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--color-background-tertiary)" }}>
        {navActivo === "Buscar cargas" && <SeccionBuscar onOfertar={(c) => setModalOferta(c)} onAlerta={() => mostrarToast("¡Alerta guardada! Te avisamos cuando aparezca una carga que te interese.")} excluirIds={ofertadasIds} />}
        {navActivo === "Mis ofertas" && <SeccionMisOfertas onToast={mostrarToast} />}
        {navActivo === "Mis viajes" && <SeccionMisViajes />}
        {navActivo === "Mensajes" && <SeccionMensajes userId={userId} />}
        {navActivo === "Notificaciones" && <SeccionNotificaciones />}
        {navActivo === "Mi flota" && <SeccionMiFlota />}
        {navActivo === "Mi perfil" && <SeccionPerfil onToast={mostrarToast} userName={userName} userEmail={userEmail} />}
      </div>

      {modalOferta && <ModalOfertar info={modalOferta} onClose={() => setModalOferta(null)} onEnviar={(cargaId) => { setOfertadasIds((prev) => new Set([...prev, cargaId])); mostrarToast("¡Oferta enviada! El dador recibirá tu propuesta."); }} />}
      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Estilos auxiliares ────────────────────────────────────────────────────────
const filterLabelStyle: React.CSSProperties = { fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 };
const filterInputStyle: React.CSSProperties = { width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" };
const filterGroupStyle: React.CSSProperties = { marginBottom: 20, paddingBottom: 20, borderBottom: "0.5px solid var(--color-border-tertiary)" };
const formLabelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 };
const formInputStyle: React.CSSProperties = { width: "100%", fontSize: 13, padding: "9px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" };

function FormCampo({ label, value, onChange, placeholder, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={formLabelStyle}>{label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={formInputStyle} />
    </div>
  );
}
