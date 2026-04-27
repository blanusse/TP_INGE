"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const TripMap = dynamic(() => import("@/app/_components/TripMap"), { ssr: false });
import { signOut, useSession } from "next-auth/react";

// ── Tipos ────────────────────────────────────────────────────────────────────

type NavItem = "Inicio" | "Buscar cargas" | "Planificar viaje" | "Mis ofertas" | "Mis viajes" | "Notificaciones" | "Mi flota" | "Mi perfil";
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
        <span key={i} style={{ color: i < Math.floor(value) ? "var(--color-brand)" : "var(--color-border-secondary)", fontSize: 11 }}>★</span>
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
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 100, background: "var(--green)", color: "#fff", padding: "12px 18px", borderRadius: "var(--border-radius-md)", fontSize: 13, fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
      <i className="fa-solid fa-circle-check" /> {mensaje}
      <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 16, padding: 0, marginLeft: 4 }}>×</button>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg0)", borderRadius: "var(--border-radius-lg)", border: "1px solid var(--border)", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: 24 }}>
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
  return { id: (load.id ?? load.id) as string, titulo, empresa: shipper?.razon_social ?? "Dador de carga", hace, precio: (load.price_base as number) ?? 0, peso: load.weight_kg ? `${(load.weight_kg as number).toLocaleString("es-AR")} kg` : "—", camion: load.truck_type_required ? (TRUCK_LABEL[load.truck_type_required as string] ?? "Cualquiera") : "Cualquiera", retiro: load.ready_at ? new Date(load.ready_at as string).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—", distancia, rating: 0, viajes: 0, badge: null, destacado: false };
}

function SeccionBuscar({ onOfertar, onAlerta, excluirIds, trucks, drivers, onNoTruck, onNoDriver }: { onOfertar: (c: ModalOfertaState) => void; onAlerta: () => void; excluirIds: Set<string | number>; trucks: TruckData[]; drivers: Driver[]; onNoTruck: () => void; onNoDriver: () => void }) {
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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 21;

  useEffect(() => {
    fetch("/api/loads/available").then((r) => r.json()).then((d) => { if (d.loads) setCargasDB(d.loads.map(dbLoadToCard)); }).catch(() => {}).finally(() => setLoadingDB(false));
  }, []);

  const toggleChip = (list: string[], setList: (v: string[]) => void, t: string) => setList(list.includes(t) ? list.filter((x) => x !== t) : [...list, t]);
  const parseKm = (d: string) => parseInt(d.replace(/\./g, "").replace(/[^0-9]/g, "")) || 0;
  const DIST_RANGOS: Record<string, [number, number]> = { todos: [0, Infinity], corta: [0, 500], media: [500, 1200], larga: [1200, 2000], muy_larga: [2000, Infinity] };
  const limpiarFiltros = () => { setTipos([]); setTiposCamion([]); setOrigen(""); setDestino(""); setDistanciaRango("todos"); setPrecioMin(""); setPrecioMax(""); setFechaDesde(""); setRatingMin("0"); setSoloDestacadas(false); setPage(1); };
  useEffect(() => { setPage(1); }, [tipos, tiposCamion, origen, destino, distanciaRango, precioMin, precioMax, fechaDesde, ratingMin, soloDestacadas, sortBy]);
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
  const totalPages = Math.ceil(cargas.length / PAGE_SIZE);
  const cargasPagina = cargas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", flex: 1 }}>
      <aside style={{ background: "var(--bg0)", borderRight: "1px solid var(--border)", padding: "16px 16px", overflowY: "auto", maxHeight: "calc(100vh - 56px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>
            <i className="fa-solid fa-sliders" style={{ marginRight: 7, color: "var(--green)" }} />Filtros
          </span>
          {hayFiltros && <button onClick={limpiarFiltros} style={{ fontSize: 11, color: "var(--text2)", background: "none", border: "1px solid var(--border2)", borderRadius: 5, cursor: "pointer", padding: "3px 8px", fontWeight: 400 }}>Limpiar todo</button>}
        </div>

        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}><i className="fa-solid fa-map-pin" style={{ marginRight: 6 }} />Ruta</div>
          <input value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Origen..." style={{ ...filterInputStyle, marginBottom: 6 }} />
          <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Destino..." style={filterInputStyle} />
        </div>

        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}><i className="fa-solid fa-ruler-horizontal" style={{ marginRight: 6 }} />Distancia recorrida</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {[{ key: "todos", label: "Cualquier distancia" }, { key: "corta", label: "Hasta 500 km" }, { key: "media", label: "500 — 1.200 km" }, { key: "larga", label: "1.200 — 2.000 km" }, { key: "muy_larga", label: "Más de 2.000 km" }].map(({ key, label }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: distanciaRango === key ? "var(--text1)" : "var(--text2)", fontWeight: distanciaRango === key ? 500 : 400 }}>
                <input type="radio" name="distancia" checked={distanciaRango === key} onChange={() => setDistanciaRango(key)} style={{ accentColor: "var(--green)", cursor: "pointer" }} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}><i className="fa-solid fa-peso-sign" style={{ marginRight: 6 }} />Precio (ARS)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div><div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Mínimo</div><input type="number" value={precioMin} onChange={(e) => setPrecioMin(e.target.value)} placeholder="0" style={filterInputStyle} /></div>
            <div><div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Máximo</div><input type="number" value={precioMax} onChange={(e) => setPrecioMax(e.target.value)} placeholder="∞" style={filterInputStyle} /></div>
          </div>
        </div>

        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}><i className="fa-solid fa-box" style={{ marginRight: 6 }} />Tipo de carga</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {["Granel", "Refrigerado", "General", "Plataforma", "Peligroso", "Frágil"].map((t) => { const on = tipos.includes(t); return (<button key={t} onClick={() => toggleChip(tipos, setTipos, t)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, cursor: "pointer", border: on ? "1px solid var(--green)" : "1px solid var(--border2)", background: on ? "var(--green-muted)" : "var(--bg2)", color: on ? "var(--green)" : "var(--text2)", fontWeight: on ? 500 : 400 }}>{t}</button>); })}
          </div>
        </div>

        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}><i className="fa-solid fa-truck" style={{ marginRight: 6 }} />Tipo de camión</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {["Granelero", "Furgón", "Plataforma", "Refrigerado", "Cisterna", "Batea"].map((t) => { const on = tiposCamion.includes(t); return (<button key={t} onClick={() => toggleChip(tiposCamion, setTiposCamion, t)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, cursor: "pointer", border: on ? "1px solid var(--green)" : "1px solid var(--border2)", background: on ? "var(--green-muted)" : "var(--bg2)", color: on ? "var(--green)" : "var(--text2)", fontWeight: on ? 500 : 400 }}>{t}</button>); })}
          </div>
        </div>

        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}><i className="fa-solid fa-calendar-days" style={{ marginRight: 6 }} />Fecha de retiro desde</div>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={filterInputStyle} />
        </div>

        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}><i className="fa-solid fa-star" style={{ marginRight: 6 }} />Calificación mínima</div>
          <select value={ratingMin} onChange={(e) => setRatingMin(e.target.value)} style={{ ...filterInputStyle, cursor: "pointer" }}>
            <option value="0">Cualquier calificación</option>
            <option value="4">4.0 ★ o más</option>
            <option value="4.5">4.5 ★ o más</option>
            <option value="4.8">4.8 ★ o más</option>
          </select>
        </div>

        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={soloDestacadas} onChange={(e) => setSoloDestacadas(e.target.checked)} style={{ accentColor: "var(--green)", width: 14, height: 14, cursor: "pointer" }} />
            <span style={{ fontSize: 13, color: "var(--text2)" }}>Solo cargas destacadas</span>
          </label>
        </div>

        <button onClick={onAlerta} style={{ width: "100%", fontSize: 13, padding: "9px", borderRadius: 6, background: "var(--green)", border: "none", color: "#fff", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <i className="fa-solid fa-magnifying-glass" />Aplicar filtros
        </button>
      </aside>

      <main style={{ padding: 16, background: "var(--bg1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Ordenar por</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={{ height: 34, fontSize: 13, padding: "0 10px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--bg2)", color: "var(--text1)", cursor: "pointer", outline: "none" }}>
            <option>Mayor precio</option><option>Menor precio</option><option>Más cercano</option><option>Fecha de retiro</option>
          </select>
          <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
            <i className="fa-solid fa-truck-fast" />{loadingDB ? "Cargando..." : `${cargasPagina.length} de ${cargas.length} cargas disponibles`}
          </span>
        </div>
        {!loadingDB && cargas.length === 0 && (
          <div style={{ textAlign: "center", padding: "56px 20px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--green-muted)", border: "1px solid var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 22, color: "var(--green)" }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text1)", marginBottom: 6, lineHeight: 1.7 }}>No hay cargas disponibles</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20, lineHeight: 1.7 }}>Ajustá los filtros o ampliá el rango de distancia y precio.</div>
            <button onClick={limpiarFiltros} style={{ fontSize: 13, padding: "7px 18px", borderRadius: 6, border: "1px solid var(--border2)", background: "transparent", color: "var(--text2)", cursor: "pointer" }}>Limpiar filtros</button>
          </div>
        )}
        {cargasPagina.map((c) => {
          const partes = c.titulo.split(" — ");
          const tipoCarga = partes[0];
          const ruta = partes[1] ?? c.titulo;
          const [or, dest] = ruta.split(" → ");
          return (
            <div key={c.id} style={{ background: "var(--bg0)", border: "1px solid var(--border)", borderLeft: "3px solid var(--green)", borderRadius: 8, padding: 16, marginBottom: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--green-muted)", color: "var(--green)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{tipoCarga}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--green)" }}>${c.precio.toLocaleString("es-AR")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 17, fontWeight: 600, color: "var(--text1)" }}>{or}</span>
                <i className="fa-solid fa-arrow-right" style={{ fontSize: 13, color: "var(--green)" }} />
                <span style={{ fontSize: 17, fontWeight: 600, color: "var(--text1)" }}>{dest}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>{c.empresa} · {c.hace}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                {[["Peso", c.peso], ["Camión", c.camion], ["Retiro", c.retiro], ["Distancia", c.distancia]].map(([label, val]) => (
                  <div key={label}><div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{label}</div><div style={{ fontSize: 12, color: "var(--text1)" }}>{val}</div></div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                <div style={{ fontSize: 12, color: "var(--text2)" }}><Stars value={c.rating} /> {c.rating} · {c.viajes} viajes{c.badge && <span style={{ color: "var(--green)" }}> · {c.badge}</span>}</div>
                {trucks.length === 0
                  ? <button onClick={(e) => { e.stopPropagation(); onNoTruck(); }} title="Registrá un camión en Mi flota para poder ofertar" style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border2)", background: "transparent", color: "var(--text2)", cursor: "pointer" }}>Sin camión</button>
                  : drivers.length === 0
                  ? <button onClick={(e) => { e.stopPropagation(); onNoDriver(); }} title="Registrá un camionero en Mi flota para poder ofertar" style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border2)", background: "transparent", color: "var(--text2)", cursor: "pointer" }}>Sin camionero</button>
                  : <button onClick={(e) => { e.stopPropagation(); onOfertar({ cargaId: c.id, titulo: c.titulo, empresa: c.empresa, precioBase: c.precio }); }} style={{ fontSize: 13, padding: "6px 16px", borderRadius: 6, border: "none", background: "var(--green)", color: "#fff", cursor: "pointer", fontWeight: 500 }}>Ofertar</button>
                }
              </div>
            </div>
          );
        })}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "16px 0 8px" }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ fontSize: 13, padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--bg2)", color: page === 1 ? "var(--text3)" : "var(--text1)", cursor: page === 1 ? "default" : "pointer" }}>
              <i className="fa-solid fa-chevron-left" style={{ marginRight: 6 }} />Anterior
            </button>
            <span style={{ fontSize: 13, color: "var(--text2)" }}>Página {page} de {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ fontSize: 13, padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--bg2)", color: page === totalPages ? "var(--text3)" : "var(--text1)", cursor: page === totalPages ? "default" : "pointer" }}>
              Siguiente<i className="fa-solid fa-chevron-right" style={{ marginLeft: 6 }} />
            </button>
          </div>
        )}
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
  const estadoStyle: Record<string, { bg: string; color: string }> = { pending: { bg: "var(--green-glow)", color: "var(--green)" }, countered: { bg: "rgba(37,99,235,0.15)", color: "#3b82f6" }, accepted: { bg: "rgba(22,163,74,0.15)", color: "#16a34a" }, rejected: { bg: "rgba(220,38,38,0.15)", color: "#dc2626" } };

  return (
    <main style={{ padding: 20, flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 16 }}>Mis ofertas</div>
      {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
      {!loading && ofertas.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 20px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--green-muted)", border: "1px solid var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <i className="fa-solid fa-handshake" style={{ fontSize: 22, color: "var(--green)" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text1)", marginBottom: 6, lineHeight: 1.7 }}>Sin ofertas todavía</div>
          <div style={{ fontSize: 13, color: "var(--text2)" }}>Buscá cargas disponibles y enviá tu primera oferta.</div>
        </div>
      )}
      {!loading && ofertas.map((o) => (
        <div key={o.id} style={{ background: "var(--bg0)", border: o.estado === "countered" ? "1px solid #3b82f6" : "1px solid var(--border)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div><div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{o.titulo}</div><div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{o.empresa} · {o.fecha}</div></div>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: estadoStyle[o.estado]?.bg, color: estadoStyle[o.estado]?.color }}>{estadoLabel[o.estado]}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
            <div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>Precio base del dador</div><div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{o.precioBase ? `$${o.precioBase.toLocaleString("es-AR")}` : "—"}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>Tu oferta</div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-brand-dark)" }}>{o.miOferta != null ? `$${o.miOferta.toLocaleString("es-AR")}` : "—"}</div></div>
          </div>
          {o.estado === "countered" && o.counterPrice != null && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(37,99,235,0.1)", borderRadius: "var(--border-radius-md)", border: "1px solid rgba(37,99,235,0.3)" }}>
              <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, marginBottom: 8 }}>El dador propuso un nuevo precio: <span style={{ fontSize: 15 }}>${o.counterPrice.toLocaleString("es-AR")}</span></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => accion(o.id, "accept_counter")} disabled={accionando === o.id + "accept_counter"} style={{ flex: 1, padding: "8px 0", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: accionando === o.id + "accept_counter" ? 0.6 : 1 }}>Aceptar contraoferta</button>
                <button onClick={() => accion(o.id, "reject_counter")} disabled={accionando === o.id + "reject_counter"} style={{ flex: 1, padding: "8px 0", borderRadius: "var(--border-radius-md)", border: "1px solid rgba(220,38,38,0.4)", background: "rgba(220,38,38,0.1)", color: "#dc2626", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: accionando === o.id + "reject_counter" ? 0.6 : 1 }}>Rechazar</button>
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

type TabViajes = "En curso" | "Próximos" | "Completados" | "Cobros";

interface Cobro { id: string; fecha: string; dador: string; ruta: string; monto: number; }

function TabCobros() {
  const now = new Date();
  const firstOfYear = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(today);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCobros = async (f = from, t = to) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    const res = await fetch(`/api/cobros?${params}`);
    const data = await res.json();
    if (data.cobros) setCobros(data.cobros);
    setLoading(false);
  };

  useEffect(() => { fetchCobros(); }, []);

  const exportarCSV = () => {
    const header = "Fecha,Dador,Ruta,Monto";
    const rows = cobros.map((c) => `${c.fecha},"${c.dador}","${c.ruta}",${c.monto}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobros-${from}-${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const total = cobros.reduce((sum, c) => sum + c.monto, 0);
  const inputStyle: React.CSSProperties = { fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", marginBottom: 4, textTransform: "uppercase" as const }}>Desde</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", marginBottom: 4, textTransform: "uppercase" as const }}>Hasta</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </div>
        <button onClick={() => fetchCobros()} style={{ fontSize: 13, padding: "8px 18px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Aplicar</button>
        {cobros.length > 0 && (
          <button onClick={exportarCSV} style={{ fontSize: 13, padding: "8px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <i className="fa-solid fa-download" style={{ fontSize: 12 }} /> Exportar CSV
          </button>
        )}
      </div>

      {loading && <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}

      {!loading && cobros.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--green-muted)", border: "1px solid var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <i className="fa-solid fa-receipt" style={{ fontSize: 22, color: "var(--green)" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text1)", marginBottom: 6 }}>Sin cobros en el período</div>
          <div style={{ fontSize: 13, color: "var(--text2)" }}>Ajustá el rango de fechas para ver otros resultados.</div>
        </div>
      )}

      {!loading && cobros.length > 0 && (
        <>
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "14px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{cobros.length} cobro{cobros.length !== 1 ? "s" : ""} en el período</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>${total.toLocaleString("es-AR")} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-text-tertiary)" }}>ARS</span></span>
          </div>
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                  {["Fecha", "Dador", "Ruta", "Monto"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cobros.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < cobros.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" as const }}>{c.fecha}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--color-text-primary)" }}>{c.dador}</td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{c.ruta}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--color-brand-dark)", whiteSpace: "nowrap" as const }}>${c.monto.toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

interface TripData { offerId: string; loadId: string; titulo: string; empresa: string; precio: number; fechaRetiro: string; pickupCity: string; dropoffCity: string; pickupExact: string | null; dropoffExact: string | null; pickupLat: number | null; pickupLon: number | null; dropoffLat: number | null; dropoffLon: number | null; status: string; yaCalifiqué: boolean; }

function ModalCalificarDador({ offerId, empresa, onClose }: { offerId: string; empresa: string; onClose: () => void }) {
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [done, setDone] = useState(false);
  const enviar = async () => { if (!score) return; setEnviando(true); try { await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId, score }) }); setDone(true); } finally { setEnviando(false); } };
  if (done) return (<Modal title="¡Gracias por calificar!" onClose={onClose}><div style={{ textAlign: "center", padding: "28px 20px" }}><div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--green-muted)", border: "1px solid var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><i className="fa-solid fa-star" style={{ fontSize: 22, color: "var(--green)" }} /></div><div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>Calificación enviada</div><div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>Tu opinión ayuda a la comunidad de CargaBack.</div><button onClick={onClose} style={{ fontSize: 14, padding: "10px 28px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Cerrar</button></div></Modal>);
  return (
    <Modal title={`Calificá a ${empresa}`} onClose={onClose}>
      <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>¿Cómo fue tu experiencia con este dador de carga?</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map((s) => (<button key={s} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => setScore(s)} style={{ fontSize: 36, background: "none", border: "none", cursor: "pointer", color: s <= (hover || score) ? "var(--color-brand)" : "var(--color-border-secondary)", transition: "color 0.1s", padding: "0 2px" }}>★</button>))}
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
    <div style={{ background: "var(--bg0)", border: "1px solid var(--border)", borderRadius: "var(--border-radius-lg)", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => setBase(new Date(year, month - 1, 1))} style={{ width: 28, height: 28, borderRadius: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="fa-solid fa-chevron-left" style={{ fontSize: 11 }} /></button>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)" }}>{MESES[month]} {year}</span>
        <button onClick={() => setBase(new Date(year, month + 1, 1))} style={{ width: 28, height: 28, borderRadius: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="fa-solid fa-chevron-right" style={{ fontSize: 11 }} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
        {["Lu","Ma","Mi","Ju","Vi","Sa","Do"].map((d) => (<div key={d} style={{ textAlign: "center", fontSize: 11, color: "var(--text3)", fontWeight: 500, padding: "2px 0" }}>{d}</div>))}
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

function SeccionMisViajes({ userId }: { userId: string }) {
  const [tab, setTab] = useState<TabViajes>("En curso");
  const [trips, setTrips] = useState<{ enCurso: TripData[]; proximos: TripData[]; completados: TripData[] }>({ enCurso: [], proximos: [], completados: [] });
  const [loading, setLoading] = useState(true);
  const [modalCalificar, setModalCalificar] = useState<{ offerId: string; empresa: string } | null>(null);
  const [calificados, setCalificados] = useState<Set<string>>(new Set());
  const [tripSeleccionado, setTripSeleccionado] = useState<TripData | null>(null);

  useEffect(() => {
    fetch("/api/trips/mine").then((r) => r.json()).then((d) => {
      setTrips({ enCurso: d.enCurso ?? [], proximos: d.proximos ?? [], completados: d.completados ?? [] });
      const alreadyRated = new Set<string>((d.completados ?? []).filter((t: TripData) => t.yaCalifiqué).map((t: TripData) => t.offerId));
      setCalificados(alreadyRated);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (tripSeleccionado) return <VistaTripDetalle t={tripSeleccionado} userId={userId} onVolver={() => setTripSeleccionado(null)} />;

  const tabData = { "En curso": trips.enCurso, "Próximos": trips.proximos, "Completados": trips.completados, "Cobros": [] as TripData[] };
  const current = tabData[tab] ?? [];

  const TripCard = ({ t }: { t: TripData }) => {
    const partes = t.titulo.split(" — "); const tipoCarga = partes[0]; const ruta = partes[1] ?? t.titulo; const [or, dest] = ruta.split(" → ");
    const completado = t.status === "delivered"; const yaCalif = calificados.has(t.offerId);
    const retiroExacto = t.pickupExact && t.pickupExact !== t.pickupCity ? t.pickupExact : null;
    const entregaExacta = t.dropoffExact && t.dropoffExact !== t.dropoffCity ? t.dropoffExact : null;
    return (
      <div onClick={() => setTripSeleccionado(t)} style={{ background: "var(--bg0)", border: `1px solid var(--border)`, borderLeft: `3px solid ${completado ? "#16a34a" : tab === "En curso" ? "var(--green)" : "#3b82f6"}`, borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10, cursor: "pointer" }}>
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
        {(retiroExacto || entregaExacta) && (<div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 8, display: "flex", flexDirection: "column", gap: 4 }}>{retiroExacto && <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}><i className="fa-solid fa-location-dot" style={{ marginRight: 4, color: "var(--green)" }} /><strong>Retiro:</strong> {retiroExacto}</div>}{entregaExacta && <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}><i className="fa-solid fa-location-dot" style={{ marginRight: 4, color: "var(--green)" }} /><strong>Entrega:</strong> {entregaExacta}</div>}</div>)}
        {completado && (<div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8, paddingTop: 8, borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", justifyContent: "flex-end" }}>{yaCalif ? (<span style={{ fontSize: 12, color: "var(--text3)", padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }}><i className="fa-solid fa-circle-check" style={{ color: "var(--green)" }} />Ya calificaste este viaje</span>) : (<button onClick={() => setModalCalificar({ offerId: t.offerId, empresa: t.empresa })} style={{ fontSize: 12, padding: "7px 16px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", fontWeight: 600, cursor: "pointer" }}><i className="fa-solid fa-star" style={{ marginRight: 5 }} />Calificar dador</button>)}</div>)}
      </div>
    );
  };

  return (
    <main style={{ padding: "20px 24px", flex: 1 }}>
      {modalCalificar && <ModalCalificarDador offerId={modalCalificar.offerId} empresa={modalCalificar.empresa} onClose={() => { setCalificados((prev) => new Set([...prev, modalCalificar.offerId])); setModalCalificar(null); }} />}
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 16 }}>Mis viajes</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {([
        { t: "En curso" as TabViajes, faIcon: "fa-truck-moving", count: trips.enCurso.length, desc: "Viaje activo ahora" },
        { t: "Próximos" as TabViajes, faIcon: "fa-calendar-check", count: trips.proximos.length, desc: "Confirmados" },
        { t: "Completados" as TabViajes, faIcon: "fa-flag-checkered", count: trips.completados.length, desc: "Historial" },
        { t: "Cobros" as TabViajes, faIcon: "fa-receipt", count: trips.completados.length, desc: "Historial de cobros" },
      ]).map(({ t, faIcon, count, desc }) => {
        const active = tab === t;
        return (
          <button key={t} onClick={() => setTab(t)} style={{ border: `1px solid ${active ? "var(--green)" : "var(--border)"}`, borderRadius: "var(--border-radius-lg)", background: "var(--bg0)", padding: "18px 20px", cursor: "pointer", textAlign: "left" as const, boxShadow: active ? "0 0 0 3px var(--green-glow)" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: active ? "var(--green-muted)" : "var(--bg2)", border: `1px solid ${active ? "var(--green-dim)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className={`fa-solid ${faIcon}`} style={{ fontSize: 16, color: active ? "var(--green)" : "var(--text3)" }} />
              </div>
              <span style={{ fontSize: 28, fontWeight: 600, color: "var(--text1)", lineHeight: 1 }}>{count}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)", marginBottom: 3 }}>{t}</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>{desc}</div>
          </button>
        );
      })}
      </div>
      {tab === "Cobros" && <TabCobros />}
      {loading && tab !== "Cobros" && <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
      {!loading && tab !== "Cobros" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
          <div>{current.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--green-muted)", border: "1px solid var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <i className="fa-solid fa-route" style={{ fontSize: 22, color: "var(--green)" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text1)", marginBottom: 6, lineHeight: 1.7 }}>Sin viajes en esta categoría</div>
              <div style={{ fontSize: 13, color: "var(--text2)" }}>Los viajes aceptados van a aparecer acá.</div>
            </div>
          ) : (current.map((t) => <TripCard key={t.offerId} t={t} />))}</div>
          <Calendario eventos={[]} />
        </div>
      )}
    </main>
  );
}

interface MensajeChat { id: string; senderId: string; texto: string; hora: string; }

function VistaTripDetalle({ t, userId, onVolver }: { t: TripData; userId: string; onVolver: () => void }) {
  const partes = t.titulo.split(" — ");
  const tipoCarga = partes[0];
  const ruta = partes[1] ?? t.titulo;
  const [or, dest] = ruta.split(" → ");

  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Confirmación de entrega ───────────────────────────────────────────────
  const [codigoInput, setCodigoInput] = useState("");
  const [codigoVerificado, setCodigoVerificado] = useState(false);
  const [entregaCompletada, setEntregaCompletada] = useState(t.status === "delivered");
  const [payoutMethod, setPayoutMethod] = useState<"cvu_cbu" | "mercadopago" | null>(null);
  const [payoutDestination, setPayoutDestination] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<{ amount: number; transfer_initiated: boolean; transfer_error?: { httpStatus?: number; message?: string } | null } | null>(null);

  let km: number | null = null;
  if (t.pickupLat != null && t.pickupLon != null && t.dropoffLat != null && t.dropoffLon != null) {
    km = Math.round(haversineKm(t.pickupLat, t.pickupLon, t.dropoffLat, t.dropoffLon));
  }

  useEffect(() => {
    fetch(`/api/messages?offerId=${t.offerId}`).then((r) => r.json()).then((d) => {
      if (d.messages) {
        setMensajes(d.messages.map((m: { id: string; senderId: string; content: string; hora: string }) => ({ id: m.id, senderId: m.senderId, texto: m.content, hora: m.hora })));
        setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50);
      }
    }).catch(() => {});
  }, [t.offerId]);

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId: t.offerId, content: texto.trim() }) });
      if (res.ok) { const data = await res.json(); const m = data.message; setMensajes((prev) => [...prev, { id: m.id, senderId: m.senderId, texto: m.content, hora: m.hora }]); setTexto(""); setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50); }
    } finally { setEnviando(false); }
  };

  const statusLabel: Record<string, { label: string; color: string }> = {
    in_transit: { label: "En tránsito", color: "var(--green)" },
    matched:    { label: "Confirmado",  color: "#3b82f6" },
    delivered:  { label: "Entregado",   color: "#16a34a" },
  };
  const st = statusLabel[t.status] ?? { label: t.status, color: "var(--color-text-tertiary)" };

  const metaFields: [string, string][] = [
    ["Empresa", t.empresa],
    ["Precio acordado", `$${t.precio.toLocaleString("es-AR")}`],
    ["Fecha de retiro", t.fechaRetiro],
    ["Tipo de carga", tipoCarga],
    ...(t.pickupExact ? [["Retiro exacto", t.pickupExact] as [string, string]] : []),
    ...(t.dropoffExact ? [["Entrega exacta", t.dropoffExact] as [string, string]] : []),
  ];

  const handleConfirmarEntrega = async () => {
    if (!codigoInput.trim() || !payoutMethod || !payoutDestination.trim()) return;
    setConfirmando(true);
    setConfirmError(null);
    try {
      const res = await fetch("/api/payments/confirm-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loadId: t.loadId,
          code: codigoInput.trim().toUpperCase(),
          payoutMethod,
          payoutDestination,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setConfirmError(data.message ?? data.error ?? "Error al confirmar."); return; }
      setEntregaCompletada(true);
      setConfirmSuccess({ amount: data.amount, transfer_initiated: !!data.transfer_initiated, transfer_error: data.transfer_error ?? null });
    } catch {
      setConfirmError("Error de conexión. Intentá de nuevo.");
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <main style={{ padding: "20px 24px", flex: 1, maxWidth: 900 }}>
      <button onClick={onVolver} style={{ fontSize: 13, color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer", marginBottom: 16, padding: 0 }}>← Volver a mis viajes</button>

      {/* Tarjeta de ruta */}
      <div style={{ background: "var(--bg0)", border: "1px solid var(--border)", borderRadius: "var(--border-radius-lg)", padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text-primary)" }}>{or}</span>
          <span style={{ fontSize: 20, color: "var(--color-brand)", fontWeight: 700 }}>→</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text-primary)" }}>{dest}</span>
          {km != null && <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>{km.toLocaleString("es-AR")} km</span>}
          <span style={{ marginLeft: "auto", fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: `${st.color}22`, color: st.color }}>{st.label}</span>
        </div>

        {/* Visualización de ruta */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--color-brand)", boxShadow: "0 0 0 3px var(--color-brand-light)" }} />
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500, maxWidth: 80, textAlign: "center", lineHeight: 1.3 }}>{or}</div>
          </div>
          <div style={{ flex: 1, height: 3, background: "linear-gradient(90deg, var(--color-brand), #3b82f6)", borderRadius: 2, margin: "0 12px", marginBottom: 16 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 0 3px #dbeafe" }} />
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500, maxWidth: 80, textAlign: "center", lineHeight: 1.3 }}>{dest}</div>
          </div>
        </div>

        {/* Metadatos */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 16 }}>
          {metaFields.map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mapa en tiempo real (solo viajes en tránsito) */}
      {t.status === "in_transit" && (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
            Ubicación en tiempo real
          </div>
          <TripMap
            loadId={t.loadId}
            originLat={t.pickupLat}
            originLng={t.pickupLon}
            destLat={t.dropoffLat}
            destLng={t.dropoffLon}
            height={300}
            isDriver
          />
        </div>
      )}

      {/* ── Panel de confirmación de entrega ── */}
      {(t.status === "in_transit" || t.status === "matched" || entregaCompletada) && (
        <div style={{ background: "var(--color-background-primary)", border: `1.5px solid ${entregaCompletada ? "#16a34a" : "#3b82f6"}`, borderRadius: "var(--border-radius-lg)", padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: entregaCompletada ? "#16a34a" : "var(--color-text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            {entregaCompletada
              ? <><i className="fa-solid fa-circle-check" style={{ color: "#16a34a" }} /> Entrega confirmada</>
              : <><i className="fa-solid fa-key" style={{ color: "#3b82f6" }} /> Código de confirmación</>}
          </div>

          {/* Éxito final */}
          {(entregaCompletada || confirmSuccess) && (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#16a34a", marginBottom: 6 }}>
                ¡Entrega completada!
              </div>
              {confirmSuccess && (
                <div style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                  {confirmSuccess.transfer_initiated ? (
                    <>
                      <span style={{ color: "#16a34a", fontWeight: 600 }}>¡Transferencia iniciada!</span>{" "}
                      El cobro de <strong>${confirmSuccess.amount.toLocaleString("es-AR")}</strong> está en camino. Llegará en las próximas horas.
                    </>
                  ) : (
                    <>
                      El cobro de <strong>${confirmSuccess.amount.toLocaleString("es-AR")}</strong> fue registrado.
                      {confirmSuccess.transfer_error?.message && (
                        <div style={{ marginTop: 8, fontSize: 11, background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, padding: "6px 10px", color: "#b91c1c", fontFamily: "monospace" }}>
                          MP error {confirmSuccess.transfer_error.httpStatus}: {confirmSuccess.transfer_error.message}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {entregaCompletada && !confirmSuccess && (
                <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
                  Este viaje ya fue confirmado y el cobro fue procesado.
                </div>
              )}
            </div>
          )}

          {/* Paso 1: Ingresar código */}
          {!entregaCompletada && !codigoVerificado && (
            <>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
                Pedile el código de confirmación de 8 caracteres a la persona que recibe la carga.
              </div>
              <input
                value={codigoInput}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
                  setCodigoInput(val);
                  if (val.length === 8) setTimeout(() => setCodigoVerificado(true), 200);
                }}
                placeholder="XXXX-XXXX"
                maxLength={8}
                autoComplete="off"
                style={{ width: "100%", fontSize: 28, fontWeight: 700, letterSpacing: "0.25em", textAlign: "center", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${codigoInput.length === 8 ? "#3b82f6" : "var(--color-border-secondary)"}`, background: "var(--color-background-secondary)", color: codigoInput.length === 8 ? "#3b82f6" : "var(--color-text-primary)", outline: "none", fontFamily: "monospace", textTransform: "uppercase", boxSizing: "border-box" as const, transition: "border-color 0.15s, color 0.15s" }}
              />
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center", marginTop: 6 }}>
                {codigoInput.length}/8 caracteres{codigoInput.length === 8 ? " — verificando..." : ""}
              </div>
            </>
          )}

          {/* Paso 2: Elegir método de cobro */}
          {!entregaCompletada && codigoVerificado && (
            <>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 14 }}>
                Código <strong style={{ fontFamily: "monospace", letterSpacing: "0.1em" }}>{codigoInput}</strong> ingresado. Elegí cómo querés cobrar:
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                {([
                  { id: "cvu_cbu" as const, label: "CVU / CBU / Alias", icon: "fa-solid fa-building-columns", desc: "Transferencia bancaria" },
                  { id: "mercadopago" as const, label: "Mercado Pago", icon: "fa-brands fa-google-pay", desc: "A tu cuenta de MP" },
                ] as const).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPayoutMethod(m.id)}
                    style={{ padding: "14px 12px", borderRadius: 10, border: `2px solid ${payoutMethod === m.id ? "#3b82f6" : "var(--color-border-secondary)"}`, background: payoutMethod === m.id ? "rgba(59,130,246,0.08)" : "var(--color-background-secondary)", cursor: "pointer", textAlign: "left" as const }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: payoutMethod === m.id ? "#3b82f6" : "var(--color-text-primary)", marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{m.desc}</div>
                  </button>
                ))}
              </div>

              {payoutMethod && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                    {payoutMethod === "cvu_cbu" ? "CVU, CBU o Alias" : "Email o usuario de Mercado Pago"}
                  </label>
                  <input
                    value={payoutDestination}
                    onChange={(e) => setPayoutDestination(e.target.value)}
                    placeholder={payoutMethod === "cvu_cbu" ? "0000003100012345678901" : "tu@email.com"}
                    style={{ width: "100%", fontSize: 14, padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" as const }}
                  />
                </div>
              )}

              {confirmError && (
                <div style={{ fontSize: 13, color: "#dc2626", background: "rgba(220,38,38,0.08)", border: "0.5px solid rgba(220,38,38,0.3)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
                  ⚠ {confirmError}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setCodigoVerificado(false); setConfirmError(null); }} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>
                  Cambiar código
                </button>
                <button
                  onClick={handleConfirmarEntrega}
                  disabled={confirmando || !payoutMethod || !payoutDestination.trim()}
                  style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: 8, border: "none", background: confirmando || !payoutMethod || !payoutDestination.trim() ? "#d1d5db" : "#16a34a", color: "#fff", fontWeight: 700, cursor: confirmando || !payoutMethod || !payoutDestination.trim() ? "not-allowed" : "pointer" }}>
                  {confirmando ? "Procesando..." : "Confirmar entrega y cobrar"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Chat inline */}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 14 }}>Chat con {t.empresa}</div>
        <div ref={listRef} style={{ height: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 12, paddingRight: 4 }}>
          {mensajes.length === 0 && <div style={{ textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13, marginTop: 80 }}>Sin mensajes todavía.</div>}
          {mensajes.map((m) => { const esYo = m.senderId === userId; return (<div key={m.id} style={{ display: "flex", justifyContent: esYo ? "flex-end" : "flex-start" }}><div style={{ maxWidth: "75%", padding: "9px 13px", borderRadius: esYo ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: esYo ? "var(--color-brand)" : "var(--color-background-secondary)", color: esYo ? "#fff" : "var(--color-text-primary)", fontSize: 13, lineHeight: 1.5 }}>{m.texto}<div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: "right" }}>{m.hora}</div></div></div>); })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} placeholder="Escribí un mensaje..." style={{ flex: 1, fontSize: 13, padding: "9px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" }} />
          <button onClick={enviar} disabled={enviando} style={{ padding: "9px 16px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: enviando ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14, opacity: enviando ? 0.7 : 1 }}>→</button>
        </div>
      </div>
    </main>
  );
}

function SeccionNotificaciones() {
  return (
    <main style={{ padding: "28px 32px", flex: 1, maxWidth: 760 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 20 }}>Notificaciones</div>
      <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "1px solid var(--border)" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--green-muted)", border: "1px solid var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <i className="fa-solid fa-bell" style={{ fontSize: 22, color: "var(--green)" }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text1)", marginBottom: 6, lineHeight: 1.7 }}>No tenés notificaciones</div>
        <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7 }}>Las notificaciones de ofertas, pagos y viajes aparecerán aquí.</div>
      </div>
    </main>
  );
}

// ── Mi Flota ──────────────────────────────────────────────────────────────────

interface Driver { id: string; name: string; email: string; phone?: string; dni?: string; }
interface TruckData { id: string; patente: string; marca?: string; modelo?: string; año?: number; truck_type?: string; capacity_kg?: number; vtv_vence?: string; seguro_poliza?: string; seguro_vence?: string; consumo_l_100km?: number; }

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
    const patenteNorm = patente.toUpperCase().replace(/\s/g, "");
    if (!/^[A-Z]{3}\d{3}$/.test(patenteNorm) && !/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(patenteNorm)) {
      setError("Patente inválida. Usá el formato argentino: ABC123 (vieja) o AB123CD (nueva)."); return;
    }
    const añoNum = año ? parseInt(año) : null;
    if (añoNum !== null && (añoNum < 1960 || añoNum > new Date().getFullYear() + 1)) {
      setError(`El año debe estar entre 1960 y ${new Date().getFullYear() + 1}.`); return;
    }
    if (vtvVence && new Date(vtvVence) < new Date()) { setError("La VTV ya está vencida."); return; }
    if (seguroVence && new Date(seguroVence) < new Date()) { setError("El seguro ya está vencido."); return; }
    if (!tipo) { setError("Seleccioná el tipo de camión."); return; }
    if (REQUIERE_REMOLQUE.has(tipo) && !patenteRemolque.trim()) { setError(`Los ${tipo}s necesitan la patente del remolque.`); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/fleet/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patente: patenteNorm, patente_remolque: patenteRemolque || undefined,
          marca, modelo, año: añoNum || undefined, truck_type: tipo,
          capacity_kg: capacidad || undefined,
          vtv_vence: vtvVence || undefined,
          seguro_poliza: seguroPoliza || undefined, seguro_vence: seguroVence || undefined,
        }),
      });
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
        {error &&<div style={{ fontSize: 13, color: "#dc2626", background: "rgba(220,38,38,0.1)", border: "0.5px solid rgba(220,38,38,0.35)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{error}</div>}
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
    if (phone && !/^\+?\d{8,15}$/.test(phone.replace(/\s/g, ""))) { setError("El teléfono debe tener entre 8 y 15 dígitos."); return; }
    if (dni) {
      const dniLimpio = dni.replace(/\./g, "");
      if (!/^\d{7,8}$/.test(dniLimpio)) { setError("El DNI debe tener 7 u 8 dígitos numéricos."); return; }
      const num = parseInt(dniLimpio);
      if (num < 1_000_000 || num > 99_999_999) { setError("El DNI no está en el rango argentino válido."); return; }
    }
    setLoading(true);
    try {
      const res = await fetch("/api/fleet/drivers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone || undefined, dni: dni || undefined, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? data.error ?? "Error al agregar el conductor."); return; }
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
        <div style={{ background: "var(--green-muted)", border: "1px solid var(--green-dim)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: "var(--text2)", margin: 0, lineHeight: 1.5 }}>Si el conductor ya tiene cuenta en CargaBack, ingresá su email y se va a vincular automáticamente a tu flota. Si no tiene cuenta, completá todos los campos para crearle una.</p>
        </div>
        {error && <div style={{ fontSize: 13, color: "#dc2626", background: "rgba(220,38,38,0.1)", border: "0.5px solid rgba(220,38,38,0.35)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>Cancelar</button>
          <button type="submit" disabled={loading} style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: 8, border: "none", background: loading ? "#aaa" : "var(--color-brand)", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}>{loading ? "Guardando..." : "Agregar conductor"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ModalEditarCamion({ truck, onClose, onSaved }: { truck: TruckData; onClose: () => void; onSaved: (t: TruckData) => void }) {
  const [patente, setPatente] = useState(truck.patente ?? "");
  const [patenteRemolque, setPatenteRemolque] = useState((truck as any).patente_remolque ?? "");
  const [marca, setMarca] = useState(truck.marca ?? "");
  const [modelo, setModelo] = useState(truck.modelo ?? "");
  const [año, setAño] = useState(truck.año ? String(truck.año) : "");
  const [tipo, setTipo] = useState(truck.truck_type ?? "");
  const [capacidad, setCapacidad] = useState(truck.capacity_kg ? String(truck.capacity_kg) : "");
  const [vtvVence, setVtvVence] = useState(truck.vtv_vence ?? "");
  const [seguroPoliza, setSeguroPoliza] = useState(truck.seguro_poliza ?? "");
  const [seguroVence, setSeguroVence] = useState(truck.seguro_vence ?? "");
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
      const res = await fetch(`/api/fleet/trucks/${truck.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patente: patente.toUpperCase(), patente_remolque: patenteRemolque || undefined, marca, modelo, año: año || undefined, truck_type: tipo, capacity_kg: capacidad || undefined, vtv_vence: vtvVence || undefined, seguro_poliza: seguroPoliza || undefined, seguro_vence: seguroVence || undefined }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al guardar los cambios."); return; }
      onSaved(data.truck);
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Editar camión" onClose={onClose}>
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
        {error && <div style={{ fontSize: 13, color: "#dc2626", background: "rgba(220,38,38,0.1)", border: "0.5px solid rgba(220,38,38,0.35)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>Cancelar</button>
          <button type="submit" disabled={loading} style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: 8, border: "none", background: loading ? "#aaa" : "var(--color-brand)", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}>{loading ? "Guardando..." : "Guardar cambios"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ModalEditarConductor({ driver, onClose, onSaved }: { driver: Driver; onClose: () => void; onSaved: (d: Driver) => void }) {
  const [name, setName] = useState(driver.name ?? "");
  const [phone, setPhone] = useState(driver.phone ?? "");
  const [dni, setDni] = useState(driver.dni ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/fleet/drivers/${driver.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone: phone || undefined, dni: dni || undefined }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al guardar los cambios."); return; }
      onSaved({ ...driver, ...data.driver });
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Editar conductor" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <FormCampo label="Nombre y apellido" value={name} onChange={setName} placeholder="Juan Rodríguez" required />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <FormCampo label="Celular" value={phone} onChange={setPhone} placeholder="+54 9 11 1234-5678" />
          <FormCampo label="DNI" value={dni} onChange={(v) => setDni(v.replace(/\D/g, ""))} placeholder="12345678" />
        </div>
        {error && <div style={{ fontSize: 13, color: "#dc2626", background: "rgba(220,38,38,0.1)", border: "0.5px solid rgba(220,38,38,0.35)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>Cancelar</button>
          <button type="submit" disabled={loading} style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: 8, border: "none", background: loading ? "#aaa" : "var(--color-brand)", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}>{loading ? "Guardando..." : "Guardar cambios"}</button>
        </div>
      </form>
    </Modal>
  );
}

function MenuAcciones({ onEditar, onEliminar, labelEliminar = "Eliminar" }: { onEditar: () => void; onEliminar: () => void; labelEliminar?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>
        Acciones ▾
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 50, minWidth: 130, overflow: "hidden" }}>
          <button onClick={() => { setOpen(false); onEditar(); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13, background: "transparent", border: "none", color: "var(--color-text-primary)", cursor: "pointer" }}>
            Editar
          </button>
          <button onClick={() => { setOpen(false); onEliminar(); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13, background: "transparent", border: "none", color: "#dc2626", cursor: "pointer" }}>
            {labelEliminar}
          </button>
        </div>
      )}
    </div>
  );
}

function ModalConfirmarEliminar({ mensaje, onConfirmar, onCancelar }: { mensaje: string; onConfirmar: () => void; onCancelar: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <Modal title="Confirmar eliminación" onClose={onCancelar}>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>{mensaje}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancelar} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>Cancelar</button>
        <button disabled={loading} onClick={async () => { setLoading(true); await onConfirmar(); }} style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: 8, border: "none", background: loading ? "#aaa" : "#dc2626", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}>{loading ? "Eliminando..." : "Sí, eliminar"}</button>
      </div>
    </Modal>
  );
}

interface FleetStats {
  totalViajes: number;
  totalIngresos: number;
  mejorConductor: { name: string; viajes: number } | null;
  calificacionPromedio: string | null;
  perConductor: { id: string; name: string; viajes: number; ingresos: number }[];
}

function TabEstadisticas({ drivers }: { drivers: Driver[] }) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [driverId, setDriverId] = useState("");
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async (f = from, t = to, d = driverId) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    if (d) params.set("driverId", d);
    const res = await fetch(`/api/fleet/stats?${params}`);
    const data = await res.json();
    if (data.totalViajes !== undefined) setStats(data);
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const kpiCard = (label: string, value: string, sub?: string, icon?: string) => (
    <div style={{ background: "var(--bg0)", border: "1px solid var(--border)", borderRadius: "var(--border-radius-lg)", padding: "18px 20px", flex: 1, minWidth: 160 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {icon && <i className={icon} style={{ fontSize: 14, color: "var(--color-brand)" }} />}
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", marginBottom: 4, textTransform: "uppercase" }}>Desde</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" }} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", marginBottom: 4, textTransform: "uppercase" }}>Hasta</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" }} />
        </div>
        {drivers.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", marginBottom: 4, textTransform: "uppercase" }}>Conductor</div>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} style={{ fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", cursor: "pointer" }}>
              <option value="">Todos</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <button onClick={() => fetchStats()} style={{ fontSize: 13, padding: "8px 18px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
          Aplicar
        </button>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}

      {!loading && stats && (
        <>
          {/* KPI cards */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {kpiCard("Viajes en período", String(stats.totalViajes), undefined, "fa-solid fa-route")}
            {kpiCard("Ingresos en período", `$${stats.totalIngresos.toLocaleString("es-AR")}`, undefined, "fa-solid fa-dollar-sign")}
            {kpiCard("Mejor conductor", stats.mejorConductor?.name ?? "—", stats.mejorConductor ? `${stats.mejorConductor.viajes} viajes` : undefined, "fa-solid fa-trophy")}
            {kpiCard("Calificación promedio", stats.calificacionPromedio ? `${stats.calificacionPromedio} ★` : "—", undefined, "fa-solid fa-star")}
          </div>

          {/* Tabla por conductor */}
          {stats.perConductor.length > 0 && (
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)", fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>Detalle por conductor</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    {["Conductor", "Viajes", "Ingresos"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.perConductor.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: i < stats.perConductor.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--green-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--green)", flexShrink: 0 }}>{c.name.charAt(0).toUpperCase()}</div>
                          {c.name}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{c.viajes}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>${c.ingresos.toLocaleString("es-AR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {stats.perConductor.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--color-text-tertiary)", fontSize: 14 }}>No hay viajes completados en el período seleccionado.</div>
          )}
        </>
      )}
    </div>
  );
}

function SeccionMiFlota({ ownerId }: { ownerId: string }) {
  const [tabFlota, setTabFlota] = useState<"Camiones" | "Conductores" | "Estadísticas">("Camiones");
  const [trucks, setTrucks] = useState<TruckData[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingTrucks, setLoadingTrucks] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [modalCamion, setModalCamion] = useState(false);
  const [modalConductor, setModalConductor] = useState(false);
  const [editandoCamion, setEditandoCamion] = useState<TruckData | null>(null);
  const [editandoConductor, setEditandoConductor] = useState<Driver | null>(null);
  const [eliminandoCamion, setEliminandoCamion] = useState<TruckData | null>(null);
  const [eliminandoConductor, setEliminandoConductor] = useState<Driver | null>(null);
  const [emailInvitar, setEmailInvitar] = useState("");
  const [invitando, setInvitando] = useState(false);
  const [invitacionMsg, setInvitacionMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const enviarInvitacion = async () => {
    if (!emailInvitar.trim()) return;
    setInvitando(true); setInvitacionMsg(null);
    const res = await fetch("/api/fleet/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: emailInvitar }) });
    const data = await res.json();
    if (res.ok) { setInvitacionMsg({ tipo: "ok", texto: "Invitación enviada correctamente." }); setEmailInvitar(""); }
    else { setInvitacionMsg({ tipo: "error", texto: data.message ?? "Error al enviar la invitación." }); }
    setInvitando(false);
  };

  useEffect(() => {
    fetch("/api/fleet/trucks").then((r) => r.json()).then((d) => { if (d.trucks) setTrucks(d.trucks); }).catch(() => {}).finally(() => setLoadingTrucks(false));
    fetch("/api/fleet/drivers").then((r) => r.json()).then((d) => { if (d.drivers) setDrivers(d.drivers); }).catch(() => {}).finally(() => setLoadingDrivers(false));
  }, []);

  return (
    <main style={{ padding: "20px 24px", flex: 1, maxWidth: 900, margin: "0 auto", width: "100%" }}>
      {modalCamion && <ModalAgregarCamion onClose={() => setModalCamion(false)} onAdded={(t) => setTrucks((prev) => [...prev, t])} />}
      {modalConductor && <ModalAgregarConductor onClose={() => setModalConductor(false)} onAdded={(d) => setDrivers((prev) => [...prev, d])} />}
      {editandoCamion && <ModalEditarCamion truck={editandoCamion} onClose={() => setEditandoCamion(null)} onSaved={(t) => { setTrucks((prev) => prev.map((x) => x.id === t.id ? t : x)); setEditandoCamion(null); }} />}
      {editandoConductor && <ModalEditarConductor driver={editandoConductor} onClose={() => setEditandoConductor(null)} onSaved={(d) => { setDrivers((prev) => prev.map((x) => x.id === d.id ? d : x)); setEditandoConductor(null); }} />}
      {eliminandoCamion && (
        <ModalConfirmarEliminar
          mensaje={`¿Seguro que querés eliminar el camión ${eliminandoCamion.patente}? Esta acción no se puede deshacer.`}
          onCancelar={() => setEliminandoCamion(null)}
          onConfirmar={async () => { await fetch(`/api/fleet/trucks/${eliminandoCamion.id}`, { method: "DELETE" }); setTrucks((prev) => prev.filter((x) => x.id !== eliminandoCamion.id)); setEliminandoCamion(null); }}
        />
      )}
      {eliminandoConductor && (
        <ModalConfirmarEliminar
          mensaje={`¿Seguro que querés desvincular a ${eliminandoConductor.name} de tu flota?`}
          onCancelar={() => setEliminandoConductor(null)}
          onConfirmar={async () => { await fetch(`/api/fleet/drivers/${eliminandoConductor.id}`, { method: "DELETE" }); setDrivers((prev) => prev.filter((x) => x.id !== eliminandoConductor.id)); setEliminandoConductor(null); }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)" }}>Mi flota</div>
        {tabFlota !== "Estadísticas" && (
          <button
            onClick={() => tabFlota === "Camiones" ? setModalCamion(true) : setModalConductor(true)}
            style={{ fontSize: 13, padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
            + Agregar {tabFlota === "Camiones" ? "camión" : "conductor"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "inline-flex", background: "var(--color-background-secondary)", borderRadius: 8, padding: 3, gap: 2, marginBottom: 20 }}>
        {(["Camiones", "Conductores", "Estadísticas"] as const).map((t) => (
          <button key={t} onClick={() => setTabFlota(t)} style={{ fontSize: 14, padding: "8px 20px", borderRadius: 6, border: "none", cursor: "pointer", background: tabFlota === t ? "var(--color-background-primary)" : "transparent", color: tabFlota === t ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: tabFlota === t ? 600 : 400, boxShadow: tabFlota === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>{t}</button>
        ))}
      </div>

      {/* Camiones */}
      {tabFlota === "Camiones" && (
        <>
          {loadingTrucks && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
          {!loadingTrucks && trucks.length === 0 && (
            <div style={{ textAlign: "center", padding: "56px 20px" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--green-muted)", border: "1px solid var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <i className="fa-solid fa-truck-front" style={{ fontSize: 22, color: "var(--green)" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text1)", marginBottom: 6, lineHeight: 1.7 }}>Sin camiones registrados</div>
              <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20, lineHeight: 1.7 }}>Agregá tus camiones para poder recibir y aceptar cargas.</div>
              <button onClick={() => setModalCamion(true)} style={{ fontSize: 13, padding: "7px 18px", borderRadius: 6, border: "none", background: "var(--green)", color: "#fff", cursor: "pointer", fontWeight: 500 }}>+ Agregar primer camión</button>
            </div>
          )}
          {!loadingTrucks && trucks.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 16 }}>
              {trucks.map((t) => (
                <div key={t.id} style={{ background: "var(--bg0)", border: "1px solid var(--border)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "var(--border-radius-md)", background: "var(--green-muted)", border: "1px solid var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="fa-solid fa-truck-moving" style={{ fontSize: 18, color: "var(--green)" }} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>{t.patente}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{[t.marca, t.modelo, t.año].filter(Boolean).join(" ") || "Sin datos"}</div>
                    </div>
                    <MenuAcciones onEditar={() => setEditandoCamion(t)} onEliminar={() => setEliminandoCamion(t)} />
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
          {/* Invitar por email */}
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 10 }}>Invitar conductor por email</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                value={emailInvitar}
                onChange={(e) => setEmailInvitar(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviarInvitacion()}
                placeholder="conductor@email.com"
                style={{ flex: 1, fontSize: 13, padding: "8px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" }}
              />
              <button onClick={enviarInvitacion} disabled={invitando} style={{ fontSize: 13, padding: "8px 18px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: invitando ? "not-allowed" : "pointer", fontWeight: 600, opacity: invitando ? 0.7 : 1 }}>
                {invitando ? "Enviando..." : "Invitar"}
              </button>
            </div>
            {invitacionMsg && (
              <div style={{ marginTop: 8, fontSize: 12, color: invitacionMsg.tipo === "ok" ? "var(--green)" : "#dc2626" }}>
                {invitacionMsg.texto}
              </div>
            )}
          </div>

          {loadingDrivers && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
          {!loadingDrivers && drivers.length === 0 && (
            <div style={{ textAlign: "center", padding: "56px 20px", background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "1px solid var(--border)" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--green-muted)", border: "1px solid var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <i className="fa-solid fa-id-card" style={{ fontSize: 22, color: "var(--green)" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text1)", marginBottom: 6, lineHeight: 1.7 }}>No tenés conductores agregados</div>
              <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20, lineHeight: 1.7 }}>Agregá conductores para que puedan operar los camiones de tu flota.</div>
              <button onClick={() => setModalConductor(true)} style={{ fontSize: 13, padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>+ Agregar primer conductor</button>
            </div>
          )}
          {!loadingDrivers && drivers.length > 0 && (
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    {["Nombre", "DNI", "Email", "Teléfono", ""].map((h) => (<th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d, i) => (
                    <tr key={d.id} style={{ borderBottom: i < drivers.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--color-brand-dark)", flexShrink: 0 }}>{d.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}</div>
                          {d.name}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{d.dni ?? "—"}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{d.email}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{d.phone ?? "—"}</td>
                      <td style={{ padding: "12px 16px" }}>{d.id !== ownerId && <MenuAcciones onEditar={() => setEditandoConductor(d)} onEliminar={() => setEliminandoConductor(d)} labelEliminar="Desvincular" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tabFlota === "Estadísticas" && <TabEstadisticas drivers={drivers} />}
    </main>
  );
}

// ── Perfil ────────────────────────────────────────────────────────────────────

type TabPerfil = "Perfil" | "Documentos" | "Estadísticas";
interface EarningsMes { mes: string; monto: number; }
interface TipoCargaStat { tipo: string; pct: number; count: number; color: string; cantidad?: number; }
interface RutaStat { ruta: string; viajes: number; }
interface TransportistaStats { viajesCompletados: number; calificacionPromedio: number | null; memberSince: string; ingresosUltimos6Meses: EarningsMes[]; tiposCarga: TipoCargaStat[]; rutasFrecuentes: RutaStat[]; totalIngresos6m: number; viajes6m: number; }

function SeccionPerfil({ onToast, userName, userEmail }: { onToast: (m: string) => void; userName: string; userEmail: string; }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(userName);
  const [telefono, setTelefono] = useState("");
  const [tabPerfil, setTabPerfil] = useState<TabPerfil>("Perfil");
  const [stats, setStats] = useState<TransportistaStats | null>(null);
  const [showAsDriver, setShowAsDriver] = useState(true);
  const [docs, setDocs] = useState<{ id: string; tipo: string; status: string; url: string; admin_note: string | null }[]>([]);
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null);
  const initials = nombre.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";

  const TIPOS_DOC = [
    { key: "dni",    label: "DNI" },
    { key: "vtv",    label: "VTV" },
    { key: "seguro", label: "Seguro" },
    { key: "carnet", label: "Carnet de conducir" },
  ] as const;

  const todosAprobados = TIPOS_DOC.every((t) => docs.some((d) => d.tipo === t.key && d.status === "approved"));

  const fetchDocs = () => {
    fetch("/api/documents").then((r) => r.json()).then((d) => setDocs(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(() => {
    fetch("/api/stats/camionero").then((r) => r.json()).then((d) => setStats(d)).catch(() => {});
    fetch("/api/fleet/settings").then((r) => r.json()).then((d) => { if (d.show_as_fleet_driver !== undefined) setShowAsDriver(d.show_as_fleet_driver); }).catch(() => {});
    fetchDocs();
  }, []);

  const handleUpload = async (tipo: string, file: File) => {
    setUploadingTipo(tipo);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tipo", tipo);
    const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
    if (res.ok) { onToast("Documento enviado a revisión."); fetchDocs(); }
    else { onToast("Error al subir el documento."); }
    setUploadingTipo(null);
  };

  const toggleShowAsDriver = async (val: boolean) => {
    setShowAsDriver(val);
    await fetch("/api/fleet/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ show_as_fleet_driver: val }) });
  };

  return (
    <main style={{ flex: 1, background: "var(--bg1)" }}>
      <div style={{ background: "var(--bg0)", padding: "32px 40px 48px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24, maxWidth: 800 }}>
          <div style={{ width: 84, height: 84, borderRadius: "50%", background: "var(--color-brand)", border: "3px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1 }}>
            {editando ? <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ fontSize: 24, fontWeight: 700, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "var(--border-radius-md)", padding: "4px 10px", color: "#fff", outline: "none", width: "100%", maxWidth: 300 }} /> : <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{nombre}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Transportista</span>
              {todosAprobados
                ? <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}><i className="fa-solid fa-circle-check" />Documentación verificada</span>
                : <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "rgba(255,200,100,0.25)", color: "#fef3c7", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }} onClick={() => setTabPerfil("Documentos")}><i className="fa-solid fa-triangle-exclamation" />Verificación pendiente</span>
              }
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{userEmail}</div>
          </div>
          {tabPerfil === "Perfil" && <button onClick={() => { if (editando) onToast("Perfil actualizado."); setEditando(!editando); }} style={{ fontSize: 13, padding: "9px 18px", borderRadius: "var(--border-radius-md)", background: editando ? "var(--color-brand)" : "rgba(255,255,255,0.12)", border: editando ? "none" : "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontWeight: 500, flexShrink: 0 }}>{editando ? "Guardar cambios" : "Editar perfil"}</button>}
        </div>
      </div>

      <div style={{ padding: "0 40px", marginTop: -28, maxWidth: 840, margin: "-28px auto 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          {[
            { val: stats?.calificacionPromedio != null ? <>{stats.calificacionPromedio} <span style={{ color: "#f59e0b" }}>★</span></> : "—", label: stats?.calificacionPromedio != null ? "Calificación promedio" : "Calificación promedio", sub: stats?.calificacionPromedio == null ? "Sin calificaciones" : undefined },
            { val: stats ? String(stats.viajesCompletados) : "—", label: "Viajes completados" },
            { val: stats?.memberSince ? new Date(stats.memberSince).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }) : "—", label: "En plataforma desde" },
          ].map((item, idx, arr) => (<div key={item.label + idx} style={{ padding: "20px 0", textAlign: "center", borderRight: idx < arr.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}><div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)" }}>{item.val}</div><div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 4 }}>{item.label}</div>{item.sub && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{item.sub}</div>}</div>))}
        </div>
      </div>

      <div style={{ padding: "22px 40px 0", maxWidth: 840, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: 3, gap: 2 }}>
          {(["Perfil", "Documentos", "Estadísticas"] as TabPerfil[]).map((t) => (<button key={t} onClick={() => setTabPerfil(t)} style={{ fontSize: 14, padding: "8px 22px", borderRadius: "var(--border-radius-md)", border: "none", cursor: "pointer", background: tabPerfil === t ? "var(--color-background-primary)" : "transparent", color: tabPerfil === t ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: tabPerfil === t ? 600 : 400, boxShadow: tabPerfil === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>{t}</button>))}
        </div>
      </div>

      {tabPerfil === "Perfil" && (
        <div style={{ padding: "20px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 840, margin: "0 auto" }}>
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><i className="fa-solid fa-clipboard-list" style={{ color: "var(--green)" }} /> Contacto</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Teléfono</div>{editando ? <input value={telefono} onChange={(e) => setTelefono(e.target.value)} style={{ fontSize: 14, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", padding: "7px 10px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", width: "100%", boxSizing: "border-box" as const }} /> : <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{telefono || "—"}</div>}</div>
              <div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Email</div><div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{userEmail || "—"}</div></div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 24, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>Mi flota</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 2 }}>Aparecer como conductor</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Incluirte en la lista de conductores de tu flota.</div>
                </div>
                <button
                  onClick={() => toggleShowAsDriver(!showAsDriver)}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: showAsDriver ? "var(--color-brand)" : "var(--color-border-secondary)", position: "relative", flexShrink: 0, transition: "background 0.2s" }}
                >
                  <span style={{ position: "absolute", top: 3, left: showAsDriver ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </button>
              </div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/" })} style={{ fontSize: 13, padding: "12px", borderRadius: "var(--border-radius-lg)", border: "0.5px solid rgba(220,38,38,0.4)", background: "rgba(220,38,38,0.1)", color: "#dc2626", cursor: "pointer", fontWeight: 500 }}>Cerrar sesión</button>
          </div>
        </div>
      )}

      {tabPerfil === "Documentos" && (
        <div style={{ padding: "20px 40px 32px", maxWidth: 840, margin: "0 auto" }}>
          <div style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
            Subí fotos claras de cada documento. Serán revisadas por el equipo de CargaBack y verás el resultado aquí.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 16 }}>
            {TIPOS_DOC.map(({ key, label }) => {
              const doc = docs.find((d) => d.tipo === key);
              const isUploading = uploadingTipo === key;
              const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                pending:  { label: "En revisión", color: "#b45309", bg: "#fef3c7" },
                approved: { label: "Aprobado",    color: "#065f46", bg: "#d1fae5" },
                rejected: { label: "Rechazado",   color: "#991b1b", bg: "#fee2e2" },
              };
              const st = doc ? statusMap[doc.status] : null;
              return (
                <div key={key} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{label}</div>
                    {st && (
                      <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                    )}
                  </div>
                  {doc?.status === "rejected" && doc.admin_note && (
                    <div style={{ fontSize: 12, color: "#991b1b", marginBottom: 10, padding: "8px 10px", background: "#fee2e2", borderRadius: 6 }}>
                      Motivo: {doc.admin_note}
                    </div>
                  )}
                  {doc?.url && (
                    <a href={doc.url} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 12, color: "var(--color-brand)", marginBottom: 10 }}>Ver documento actual</a>
                  )}
                  <label style={{ display: "block", cursor: isUploading ? "not-allowed" : "pointer" }}>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      style={{ display: "none" }}
                      disabled={isUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(key, f); e.target.value = ""; }}
                    />
                    <div style={{ fontSize: 13, padding: "9px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px dashed var(--color-border-secondary)", textAlign: "center", color: isUploading ? "var(--color-text-tertiary)" : "var(--color-text-secondary)", background: "var(--color-background-secondary)" }}>
                      {isUploading ? "Subiendo..." : doc ? "Reemplazar documento" : "+ Subir documento"}
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
          {todosAprobados && (
            <div style={{ marginTop: 20, padding: "14px 20px", borderRadius: "var(--border-radius-lg)", background: "#d1fae5", border: "0.5px solid #6ee7b7", display: "flex", alignItems: "center", gap: 10 }}>
              <i className="fa-solid fa-circle-check" style={{ color: "#065f46", fontSize: 18 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#065f46" }}>Documentación verificada</div>
                <div style={{ fontSize: 12, color: "#065f46", opacity: 0.8 }}>Todos tus documentos están aprobados. Los dadores de carga pueden ver tu badge de verificación.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {tabPerfil === "Estadísticas" && (
        <div style={{ padding: "20px 40px 32px", maxWidth: 840, margin: "0 auto" }}>
          {!stats && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando estadísticas...</div>}
          {stats && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                {[{ val: stats.totalIngresos6m > 0 ? `$${stats.totalIngresos6m.toLocaleString("es-AR")}` : "Sin datos", label: "Ingresos últimos 6 meses", color: "#16a34a" }, { val: stats.viajes6m > 0 ? `${stats.viajes6m} viaje${stats.viajes6m !== 1 ? "s" : ""}` : "Sin datos", label: "Viajes últimos 6 meses", color: "#8b5cf6" }, { val: stats.viajes6m > 0 ? `$${Math.round(stats.totalIngresos6m / stats.viajes6m).toLocaleString("es-AR")}` : "—", label: "Ingreso promedio / viaje", color: "var(--green)" }].map(({ val, label, color }) => (<div key={label} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px 18px" }}><div style={{ fontSize: 18, fontWeight: 700, color, marginBottom: 4 }}>{val}</div><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", lineHeight: 1.4 }}>{label}</div></div>))}
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

function ModalOfertar({ info, onClose, onEnviar, trucks }: { info: ModalOfertaState; onClose: () => void; onEnviar: (cargaId: string | number) => void; trucks: TruckData[] }) {
  const [precio, setPrecio] = useState(info.precioBase.toString());
  const [truckId, setTruckId] = useState(trucks[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const diferencia = parseInt(precio || "0") - info.precioBase;
  const diff = isNaN(diferencia) ? 0 : diferencia;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      const res = await fetch("/api/offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loadId: info.cargaId, price: precio, truckId: truckId || undefined }) });
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
        {trucks.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>Camión a enviar<span style={{ color: "#ef4444", marginLeft: 2 }}>*</span></label>
            <select value={truckId} onChange={(e) => setTruckId(e.target.value)} style={{ width: "100%", fontSize: 13, padding: "9px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" as const }}>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>{t.patente}{t.marca ? ` — ${t.marca}` : ""}{t.modelo ? ` ${t.modelo}` : ""}{t.truck_type ? ` (${t.truck_type})` : ""}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>Tu precio ofertado (ARS)</label>
          <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0" required style={{ width: "100%", fontSize: 20, fontWeight: 600, padding: "10px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" }} />
          {precio && <div style={{ fontSize: 12, marginTop: 6, color: diff > 0 ? "#b91c1c" : diff < 0 ? "var(--color-brand-dark)" : "var(--color-text-tertiary)" }}>{diff === 0 ? "Igual al precio base" : diff > 0 ? `$${diff.toLocaleString("es-AR")} por encima del precio base` : `$${Math.abs(diff).toLocaleString("es-AR")} por debajo del precio base`}</div>}
        </div>
        {error && <div style={{ fontSize: 13, color: "#dc2626", background: "rgba(220,38,38,0.1)", border: "0.5px solid rgba(220,38,38,0.35)", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>Cancelar</button>
          <button type="submit" disabled={loading} style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "none", background: loading ? "#aaa" : "var(--color-brand)", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}>{loading ? "Enviando..." : "Enviar oferta →"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Inicio ────────────────────────────────────────────────────────────────────

interface InicioStats { viajesCompletados: number; calificacionPromedio: number | null; totalIngresos6m: number; viajes6m: number; ingresosUltimos6Meses: { mes: string; monto: number }[]; }
interface InicioOferta { id: string; titulo: string; miOferta: number; estado: string; }
interface ProximoViaje { titulo: string; empresa: string; precio: number; fechaRetiro: string; pickupCity: string; dropoffCity: string; }

function SeccionInicio({ trucks, userName, onNavegar }: { trucks: { id: string; patente: string; vtv_vence?: string; seguro_vence?: string }[]; userName: string; onNavegar: (nav: NavItem) => void }) {
  const [stats, setStats] = useState<InicioStats | null>(null);
  const [ofertas, setOfertas] = useState<InicioOferta[]>([]);
  const [proximoViaje, setProximoViaje] = useState<ProximoViaje | null>(null);

  useEffect(() => {
    fetch("/api/stats/camionero").then(r => r.json()).then(d => setStats(d)).catch(() => {});
    fetch("/api/offers/mine").then(r => r.json()).then(d => { if (d.offers) setOfertas(d.offers.filter((o: InicioOferta) => o.estado === "pending" || o.estado === "countered" || o.estado === "accepted")); }).catch(() => {});
    fetch("/api/trips/mine").then(r => r.json()).then(d => { const proximos: ProximoViaje[] = d.proximos ?? []; if (proximos.length > 0) setProximoViaje(proximos[0]); }).catch(() => {});
  }, []);

  const hoy = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const primerNombre = userName.split(" ")[0];

  const alertas: string[] = [];
  const ahora = new Date();
  trucks.forEach(t => {
    const checkDoc = (fecha: string | undefined, tipo: string) => {
      if (!fecha) return;
      const diff = Math.floor((new Date(fecha).getTime() - ahora.getTime()) / 86400000);
      if (diff >= 0 && diff <= 30) alertas.push(`${tipo} del camión ${t.patente} vence en ${diff === 0 ? "hoy" : `${diff} día${diff > 1 ? "s" : ""}`} (${new Date(fecha).toLocaleDateString("es-AR")})`);
    };
    checkDoc(t.vtv_vence, "VTV");
    checkDoc(t.seguro_vence, "Seguro");
  });

  const estadoLabel: Record<string, string> = { pending: "Pendiente", countered: "Contraoferta recibida", accepted: "Aceptada" };
  const estadoColor: Record<string, { bg: string; color: string }> = {
    pending: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
    countered: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" },
    accepted: { bg: "rgba(58,128,107,0.2)", color: "#3a806b" },
  };

  const ingresos6m = stats?.ingresosUltimos6Meses ?? [];
  const maxIngreso = ingresos6m.length > 0 ? Math.max(...ingresos6m.map(e => e.monto), 1) : 1;

  return (
    <main style={{ flex: 1, overflowY: "auto", background: "var(--color-background-tertiary)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text-primary)", marginBottom: 3 }}>Buen día, {primerNombre}</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{hoy.charAt(0).toUpperCase() + hoy.slice(1)}</div>
        </div>

        {alertas.map((a, i) => (
          <div key={i} style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, color: "#f59e0b", flexShrink: 0 }}>!</span>
            <span style={{ fontSize: 13, color: "#fbbf24", flex: 1 }}><strong>{a}</strong></span>
            <button onClick={() => onNavegar("Mi flota")} style={{ fontSize: 11, color: "#fbbf24", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 6, padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>Ver mi flota</button>
          </div>
        ))}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Ingresos — este mes", value: stats ? (isNaN(stats.totalIngresos6m) || stats.totalIngresos6m == null ? "Sin datos" : `$${Math.round(stats.totalIngresos6m / 6).toLocaleString("es-AR")}`) : "—", color: "var(--color-brand)", delta: null },
            { label: "Viajes — últimos 6 meses", value: stats ? String(stats.viajes6m ?? 0) : "0", color: "var(--color-text-primary)", delta: null },
            { label: "Viajes completados", value: stats ? String(stats.viajesCompletados ?? 0) : "0", color: "var(--color-text-primary)", delta: "en total" },
            { label: "Calificación", value: stats?.calificacionPromedio != null ? `${stats.calificacionPromedio} ★` : "—", color: "#f59e0b", delta: null },
          ].map(({ label, value, color, delta }) => (
            <div key={label} style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 3, lineHeight: 1 }}>{value}</div>
              {delta && <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{delta}</div>}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>Ofertas activas</div>
              <button onClick={() => onNavegar("Mis ofertas")} style={{ fontSize: 11, color: "var(--color-brand)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Ver todas</button>
            </div>
            {ofertas.length === 0 && <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", textAlign: "center", padding: "20px 0" }}>Sin ofertas activas</div>}
            {ofertas.slice(0, 4).map(o => {
              const partes = o.titulo.split(" — "); const ruta = partes[1] ?? o.titulo; const [or, dest] = ruta.split(" → ");
              return (
                <div key={o.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{or} → {dest}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>${o.miOferta.toLocaleString("es-AR")}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: estadoColor[o.estado]?.bg ?? "transparent", color: estadoColor[o.estado]?.color ?? "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{estadoLabel[o.estado] ?? o.estado}</span>
                </div>
              );
            })}
          </div>

          <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 14 }}>Próximo viaje</div>
            {!proximoViaje && <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", textAlign: "center", padding: "20px 0" }}>Sin viajes próximos</div>}
            {proximoViaje && (() => {
              const partes = proximoViaje.titulo.split(" — "); const ruta = partes[1] ?? proximoViaje.titulo; const [or, dest] = ruta.split(" → ");
              return (
                <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "var(--color-text-primary)", marginBottom: 4 }}>{or} → {dest}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>{proximoViaje.empresa} · Retiro: {proximoViaje.fechaRetiro}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[`$${proximoViaje.precio.toLocaleString("es-AR")}`].map(p => <span key={p} style={{ fontSize: 11, background: "var(--color-brand-light)", color: "var(--color-brand-dark)", padding: "3px 9px", borderRadius: 4, fontWeight: 600 }}>{p}</span>)}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {stats && ingresos6m.length > 0 && (
          <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 16 }}>Ingresos últimos 6 meses</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 90 }}>
              {ingresos6m.map((e, i, arr) => {
                const pct = (e.monto / maxIngreso) * 100;
                const isLast = i === arr.length - 1;
                return (
                  <div key={e.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
                    {e.monto > 0 && <div style={{ fontSize: 9, color: isLast ? "var(--color-brand)" : "var(--color-text-secondary)", fontWeight: isLast ? 700 : 400 }}>${(e.monto / 1000).toFixed(0)}k</div>}
                    <div style={{ width: "100%", height: `${Math.max(pct, 3)}%`, background: isLast ? "var(--color-brand)" : e.monto > 0 ? "#2a5e4f" : "var(--color-background-secondary)", borderRadius: "4px 4px 0 0" }} />
                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{e.mes}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ── Planificador de viaje ─────────────────────────────────────────────────────

interface Parada { id: string; ciudad: string; fecha: string; }
type TramoEstado = "carga_propia" | "busco_carga" | "vacio";

const TRAMO_CONFIG: Record<TramoEstado, { label: string; color: string; bg: string }> = {
  carga_propia: { label: "Ya tengo carga", color: "#16a34a", bg: "rgba(22,163,74,0.08)" },
  busco_carga:  { label: "Busco carga",    color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
  vacio:        { label: "Vacío",           color: "#dc2626", bg: "rgba(220,38,38,0.08)" },
};

function SeccionPlanificar({ trucks }: { trucks: TruckData[] }) {
  const [paradas, setParadas] = useState<Parada[]>([
    { id: "p1", ciudad: "", fecha: "" },
    { id: "p2", ciudad: "", fecha: "" },
  ]);
  const [tramos, setTramos] = useState<TramoEstado[]>(["busco_carga"]);
  const [camionId, setCamionId] = useState(trucks[0]?.id ?? "");
  const [gasoilPrecio, setGasoilPrecio] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("gasoil-precio") ?? "";
    return "";
  });
  const [cargasDisponibles, setCargasDisponibles] = useState<CargaCard[]>([]);
  const [loadingCargas, setLoadingCargas] = useState(false);
  const [buscado, setBuscado] = useState(false);

  const addParada = () => {
    setParadas(prev => [...prev, { id: `p${Date.now()}`, ciudad: "", fecha: "" }]);
    setTramos(prev => [...prev, "busco_carga"]);
  };

  const removeParada = (idx: number) => {
    if (paradas.length <= 2) return;
    setParadas(prev => prev.filter((_, i) => i !== idx));
    const tramoIdx = idx === paradas.length - 1 ? idx - 1 : idx;
    setTramos(prev => prev.filter((_, i) => i !== tramoIdx));
  };

  const updateParada = (idx: number, field: "ciudad" | "fecha", val: string) =>
    setParadas(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));

  const updateTramo = (idx: number, estado: TramoEstado) =>
    setTramos(prev => prev.map((t, i) => i === idx ? estado : t));

  const buscarCargas = async () => {
    setLoadingCargas(true);
    setBuscado(true);
    if (gasoilPrecio && typeof window !== "undefined") localStorage.setItem("gasoil-precio", gasoilPrecio);
    try {
      const r = await fetch("/api/loads/available");
      const d = await r.json();
      if (d.loads) setCargasDisponibles(d.loads.map(dbLoadToCard));
    } catch {}
    finally { setLoadingCargas(false); }
  };

  const selectedTruck = trucks.find(t => t.id === camionId);
  const canSearch = paradas[0].ciudad.trim() !== "" && paradas[paradas.length - 1].ciudad.trim() !== "";

  const cargasPorTramo: { idx: number; cargas: CargaCard[] }[] = tramos
    .map((estado, i) => {
      if (estado !== "busco_carga") return null;
      const desde = paradas[i].ciudad.trim().toLowerCase();
      const hasta = paradas[i + 1]?.ciudad.trim().toLowerCase() ?? "";
      if (!desde || !hasta) return { idx: i, cargas: [] };
      const matches = cargasDisponibles.filter(c => {
        const parts = c.titulo.split(" — ");
        const ruta = parts[1] ?? c.titulo;
        const [or, dest] = ruta.split(" → ");
        const orLow = (or ?? "").toLowerCase();
        const destLow = (dest ?? "").toLowerCase();
        return (orLow.includes(desde) || desde.includes(orLow)) && (destLow.includes(hasta) || hasta.includes(destLow));
      });
      return { idx: i, cargas: matches };
    })
    .filter((x): x is { idx: number; cargas: CargaCard[] } => x !== null);

  return (
    <main style={{ flex: 1, overflowY: "auto", background: "var(--color-background-tertiary)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text-primary)", marginBottom: 4 }}>Planificar viaje</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Ingresá tu ruta y encontrá cargas para los tramos que quieras llenar.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>
          <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 18 }}>Ruta</div>

            {paradas.map((parada, idx) => (
              <div key={parada.id}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 10, flexShrink: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: idx === 0 ? "var(--color-brand)" : idx === paradas.length - 1 ? "#3b82f6" : "var(--color-text-tertiary)", boxShadow: `0 0 0 2px ${idx === 0 ? "rgba(29,158,117,0.3)" : idx === paradas.length - 1 ? "rgba(59,130,246,0.3)" : "var(--color-border-secondary)"}` }} />
                  </div>
                  <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    <input value={parada.ciudad} onChange={(e) => updateParada(idx, "ciudad", e.target.value)} placeholder={idx === 0 ? "Ciudad de salida" : idx === paradas.length - 1 ? "Ciudad destino" : `Parada ${idx}`} style={{ height: 33, fontSize: 13, padding: "0 9px", borderRadius: 6, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" }} />
                    <input type="date" value={parada.fecha} onChange={(e) => updateParada(idx, "fecha", e.target.value)} style={{ height: 33, fontSize: 12, padding: "0 8px", borderRadius: 6, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" }} />
                  </div>
                  {paradas.length > 2 && (
                    <button onClick={() => removeParada(idx)} style={{ marginTop: 7, width: 22, height: 22, borderRadius: "50%", border: "1px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-tertiary)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                  )}
                </div>

                {idx < paradas.length - 1 && (
                  <div style={{ marginLeft: 13, marginBottom: 4 }}>
                    <div style={{ width: 2, height: 8, background: "var(--color-border-secondary)", marginLeft: 4 }} />
                    <div style={{ background: TRAMO_CONFIG[tramos[idx]].bg, border: `1px solid ${TRAMO_CONFIG[tramos[idx]].color}40`, borderRadius: 8, padding: "7px 10px", marginBottom: 0 }}>
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 5 }}>{parada.ciudad || "..."} → {paradas[idx + 1].ciudad || "..."}</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {(["carga_propia", "busco_carga", "vacio"] as TramoEstado[]).map(e => {
                          const cfg = TRAMO_CONFIG[e];
                          const active = tramos[idx] === e;
                          return (
                            <button key={e} onClick={() => updateTramo(idx, e)} style={{ flex: 1, fontSize: 10, padding: "3px 0", borderRadius: 5, cursor: "pointer", border: active ? `1.5px solid ${cfg.color}` : "1px solid var(--color-border-secondary)", background: active ? cfg.bg : "transparent", color: active ? cfg.color : "var(--color-text-tertiary)", fontWeight: active ? 600 : 400 }}>
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ width: 2, height: 8, background: "var(--color-border-secondary)", marginLeft: 4 }} />
                  </div>
                )}
              </div>
            ))}

            <button onClick={addParada} style={{ width: "100%", fontSize: 12, padding: "7px", borderRadius: 6, border: "1px dashed var(--color-border-secondary)", background: "transparent", color: "var(--color-text-tertiary)", cursor: "pointer", marginTop: 4, marginBottom: 16 }}>
              + Agregar parada intermedia
            </button>

            <div style={{ borderTop: "1px solid var(--color-border-tertiary)", paddingTop: 16 }}>
              {trucks.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Camión</label>
                  <select value={camionId} onChange={(e) => setCamionId(e.target.value)} style={{ width: "100%", height: 33, fontSize: 13, padding: "0 9px", borderRadius: 6, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none" }}>
                    {trucks.map(t => (<option key={t.id} value={t.id}>{t.patente}{t.marca ? ` — ${t.marca}` : ""}{t.consumo_l_100km ? ` (${t.consumo_l_100km} L/100km)` : ""}</option>))}
                  </select>
                  {selectedTruck?.consumo_l_100km && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 3 }}>Consumo registrado: {selectedTruck.consumo_l_100km} L/100km</div>}
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Precio del gasoil ($/litro)</label>
                <input type="number" value={gasoilPrecio} onChange={(e) => setGasoilPrecio(e.target.value)} placeholder="ej: 1350" style={{ width: "100%", height: 33, fontSize: 13, padding: "0 9px", borderRadius: 6, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" as const }} />
              </div>
            </div>

            <button onClick={buscarCargas} disabled={!canSearch || loadingCargas} style={{ width: "100%", fontSize: 13, padding: "10px", borderRadius: 8, border: "none", background: canSearch ? "var(--color-brand)" : "var(--color-background-secondary)", color: canSearch ? "#fff" : "var(--color-text-tertiary)", cursor: canSearch ? "pointer" : "not-allowed", fontWeight: 600 }}>
              {loadingCargas ? "Buscando..." : "Buscar cargas disponibles"}
            </button>
          </div>

          <div>
            {!buscado && (
              <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 48, textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(29,158,117,0.08)", border: "1px solid rgba(29,158,117,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <i className="fa-solid fa-route" style={{ fontSize: 20, color: "var(--color-brand-dark)" }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>Configurá tu ruta</div>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Completá las paradas y marcá los tramos donde buscás carga.</div>
              </div>
            )}

            {buscado && loadingCargas && (
              <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 40, textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>
                Buscando cargas disponibles...
              </div>
            )}

            {buscado && !loadingCargas && cargasPorTramo.length === 0 && (
              <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 32, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>Sin tramos de búsqueda</div>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Marcá al menos un tramo como "Busco carga" para ver resultados.</div>
              </div>
            )}

            {buscado && !loadingCargas && cargasPorTramo.map(({ idx, cargas }) => (
              <div key={idx} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8 }}>
                  Tramo {idx + 1} — {paradas[idx].ciudad || "..."} → {paradas[idx + 1]?.ciudad || "..."}
                </div>
                {cargas.length === 0 ? (
                  <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, padding: 20, textAlign: "center" }}>
                    <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>No hay cargas disponibles para este tramo.</div>
                  </div>
                ) : (
                  cargas.map(c => {
                    const partes = c.titulo.split(" — ");
                    const tipoCarga = partes[0];
                    const ruta = partes[1] ?? c.titulo;
                    const [or, dest] = ruta.split(" → ");
                    return (
                      <div key={c.id} style={{ background: "var(--color-background-primary)", border: "1.5px solid rgba(59,130,246,0.25)", borderRadius: 10, padding: 16, marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(59,130,246,0.1)", color: "#60a5fa", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{tipoCarga}</span>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 5 }}>{or} → {dest}</div>
                            <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2 }}>{c.empresa} · Retiro: {c.retiro}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                            <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginBottom: 1 }}>Ingreso adicional</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a", lineHeight: 1 }}>+${c.precio.toLocaleString("es-AR")}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                          {[["Peso", c.peso], ["Distancia", c.distancia], ["Camión", c.camion]].filter(([, v]) => v && v !== "—").map(([label, val]) => (
                            <span key={label} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-tertiary)" }}>
                              <span style={{ color: "var(--color-text-tertiary)", marginRight: 3 }}>{label}:</span>{val}
                            </span>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>Ver detalle</button>
                          <button style={{ fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Ofertar por esta carga</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  {
    titulo: "¡Bienvenido a CargaBack! 👋",
    desc: "Te mostramos cómo sacarle el máximo provecho a la plataforma. Son solo 3 pasos rápidos.",
    target: null,
  },
  {
    titulo: "Buscá cargas disponibles",
    desc: "En la sección Buscar cargas encontrás todas las cargas disponibles cerca de tu ruta. Filtrá por origen, destino, tipo de camión y precio.",
    target: "Buscar cargas",
  },
  {
    titulo: "Planificá tu próximo viaje",
    desc: "En Planificar viaje podés armar tu ruta, ver qué cargas calzan con tu recorrido y optimizar tus tiempos para nunca volver vacío.",
    target: "Planificar viaje",
  },
];

function OnboardingOverlay({ onFinish, onNavegar }: { onFinish: () => void; onNavegar: (nav: NavItem) => void }) {
  const [paso, setPaso] = useState(0);
  const [arrowX, setArrowX] = useState<number | null>(null);
  const step = ONBOARDING_STEPS[paso];
  const esUltimo = paso === ONBOARDING_STEPS.length - 1;

  useEffect(() => {
    if (!step.target) { setArrowX(null); return; }
    const btns = document.querySelectorAll<HTMLButtonElement>("button");
    for (const btn of btns) {
      if (btn.textContent?.trim() === step.target) {
        const rect = btn.getBoundingClientRect();
        setArrowX(rect.left + rect.width / 2);
        return;
      }
    }
    setArrowX(null);
  }, [paso, step.target]);

  const siguiente = () => {
    if (step.target) onNavegar(step.target as NavItem);
    if (esUltimo) { onFinish(); return; }
    setPaso(paso + 1);
  };

  return (
    <>
      <style>{`
        @keyframes ob-bounce {
          0%   { transform: translateX(-50%) translateY(0); }
          100% { transform: translateX(-50%) translateY(-7px); }
        }
      `}</style>

      {/* Overlay semitransparente */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.18)", pointerEvents: "none" }} />

      {/* Flecha hacia el ítem de nav */}
      {arrowX !== null && (
        <div style={{
          position: "fixed", left: arrowX, top: 60, zIndex: 1002,
          transform: "translateX(-50%)",
          animation: "ob-bounce 0.7s ease-in-out infinite alternate",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
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
        top: arrowX !== null ? 100 : "50%",
        marginTop: arrowX !== null ? 0 : undefined,
        translate: arrowX !== null ? undefined : "0 -50%",
        background: "#3a806b", color: "#fff", borderRadius: 16,
        padding: "32px 36px", maxWidth: 400, width: "90%",
        boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
      }}>
        {/* Indicador de pasos */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {ONBOARDING_STEPS.map((_, i) => (
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

// ── Componente principal ──────────────────────────────────────────────────────

export default function TransportistaDashboard() {
  const { data: session } = useSession();
  const [navActivo, setNavActivo] = useState<NavItem>("Inicio");
  const [modalOferta, setModalOferta] = useState<ModalOfertaState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ofertadasIds, setOfertadasIds] = useState<Set<string | number>>(new Set());
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("transportista-theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
    const visto = localStorage.getItem("transportista-onboarding-done");
    if (!visto) setShowOnboarding(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("transportista-theme", next);
  };

  const userName  = session?.user?.name  ?? "Usuario";
  const userEmail = session?.user?.email ?? "";
  const userId    = session?.user?.id    ?? "";
  const initials  = userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
  const primerNombre = userName.split(" ")[0];
  const [ofertasBadge, setOfertasBadge] = useState(0);
  const [trucks, setTrucks] = useState<TruckData[]>([]);
  const [rootDrivers, setRootDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    fetch("/api/offers/mine").then((r) => r.json()).then((d) => {
      if (d.offers) setOfertasBadge(d.offers.filter((o: { estado: string }) => o.estado === "pending" || o.estado === "countered").length);
    }).catch(() => {});
    fetch("/api/fleet/trucks").then((r) => r.json()).then((d) => { if (d.trucks) setTrucks(d.trucks); }).catch(() => {});
    fetch("/api/fleet/drivers").then((r) => r.json()).then((d) => { if (d.drivers) setRootDrivers(d.drivers); }).catch(() => {});
  }, []);

  const mostrarToast = (msg: string) => setToast(msg);

  const navItems: NavItem[] = ["Inicio", "Buscar cargas", "Planificar viaje", "Mis ofertas", "Mis viajes", "Notificaciones", "Mi flota"];
  const NAV_ICONS: Record<NavItem, string> = {
    "Inicio": "fa-solid fa-house",
    "Buscar cargas": "fa-solid fa-magnifying-glass",
    "Planificar viaje": "fa-solid fa-map-location-dot",
    "Mis ofertas": "fa-solid fa-handshake",
    "Mis viajes": "fa-solid fa-route",
    "Notificaciones": "fa-solid fa-bell",
    "Mi flota": "fa-solid fa-truck-front",
    "Mi perfil": "fa-solid fa-user",
  };

  return (
    <>
      <div className={`transportista-${theme}`} style={{ background: "var(--bg1)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 56, background: "var(--bg0)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Link href="/" style={{ fontSize: 16, fontWeight: 700, color: "var(--text1)", textDecoration: "none", marginRight: 28, letterSpacing: "0.01em" }}>Carga<span style={{ color: "var(--green)" }}>Back</span></Link>
          <nav style={{ display: "flex", height: "100%" }}>
            {navItems.map((item) => {
              const badge = item === "Mis ofertas" ? ofertasBadge : 0;
              const active = navActivo === item;
              return (
                <button key={item} onClick={() => setNavActivo(item)} style={{ height: "100%", padding: "0 14px", background: "transparent", border: "none", borderBottom: active ? "2px solid var(--green)" : "2px solid transparent", cursor: "pointer", position: "relative", color: active ? "var(--text1)" : "var(--text2)", fontWeight: active ? 600 : 400, fontSize: 13, display: "flex", alignItems: "center", gap: 6, transition: "color 0.15s, border-color 0.15s", fontFamily: "inherit" }}>
                  <i className={NAV_ICONS[item]} style={{ fontSize: 12 }} />
                  {item}
                  {badge > 0 && <span style={{ position: "absolute", top: 10, right: 6, width: 15, height: 15, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge > 9 ? "9+" : badge}</span>}
                </button>
              );
            })}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={toggleTheme} title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} style={{ width: 30, height: 30, borderRadius: 6, background: "var(--bg2)", border: "1px solid var(--border2)", color: "var(--text1)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className={theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon"} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)" }}>{primerNombre}</span>
          <button onClick={() => setNavActivo("Mi perfil")} title="Ver mi perfil" style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--green-muted)", border: "1px solid var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--green)", cursor: "pointer" }}>{initials}</button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg1)" }}>
        {navActivo === "Inicio" && <SeccionInicio trucks={trucks} userName={userName} onNavegar={setNavActivo} />}
        {navActivo === "Buscar cargas" && <SeccionBuscar onOfertar={(c) => setModalOferta(c)} onAlerta={() => mostrarToast("¡Alerta guardada! Te avisamos cuando aparezca una carga que te interese.")} excluirIds={ofertadasIds} trucks={trucks} drivers={rootDrivers} onNoTruck={() => mostrarToast("Necesitás registrar al menos un camión en Mi flota para poder ofertar.")} onNoDriver={() => mostrarToast("Necesitás registrar al menos un camionero en Mi flota para poder ofertar.")} />}
        {navActivo === "Planificar viaje" && <SeccionPlanificar trucks={trucks} />}
        {navActivo === "Mis ofertas" && <SeccionMisOfertas onToast={mostrarToast} />}
        {navActivo === "Mis viajes" && <SeccionMisViajes userId={userId} />}
        {navActivo === "Notificaciones" && <SeccionNotificaciones />}
        {navActivo === "Mi flota" && <SeccionMiFlota ownerId={userId} />}
        {navActivo === "Mi perfil" && <SeccionPerfil onToast={mostrarToast} userName={userName} userEmail={userEmail} />}
      </div>

      {modalOferta && <ModalOfertar info={modalOferta} trucks={trucks} onClose={() => setModalOferta(null)} onEnviar={(cargaId) => { setOfertadasIds((prev) => new Set([...prev, cargaId])); mostrarToast("¡Oferta enviada! El dador recibirá tu propuesta."); }} />}
      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </div>
    {showOnboarding && (
      <OnboardingOverlay
        onFinish={() => { localStorage.setItem("transportista-onboarding-done", "1"); setShowOnboarding(false); }}
        onNavegar={setNavActivo}
      />
    )}
    </>
  );
}

// ── Estilos auxiliares ────────────────────────────────────────────────────────
const filterLabelStyle: React.CSSProperties = { fontSize: 10, color: "var(--text3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, display: "flex", alignItems: "center" };
const filterInputStyle: React.CSSProperties = { width: "100%", height: 34, fontSize: 13, padding: "0 10px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--bg2)", color: "var(--text1)", outline: "none", boxSizing: "border-box" as const };
const filterGroupStyle: React.CSSProperties = { marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid var(--border)" };
const formLabelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 500, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.08em" };
const formInputStyle: React.CSSProperties = { width: "100%", height: 34, fontSize: 13, padding: "0 12px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--bg2)", color: "var(--text1)", outline: "none", boxSizing: "border-box" as const };

function FormCampo({ label, value, onChange, placeholder, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={formLabelStyle}>{label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={formInputStyle} />
    </div>
  );
}

