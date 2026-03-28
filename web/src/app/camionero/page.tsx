"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

// ── Datos ────────────────────────────────────────────────────────────────────

// ── Tipos ────────────────────────────────────────────────────────────────────

type NavItem = "Buscar cargas" | "Mis ofertas" | "Mis viajes" | "Mensajes" | "Notificaciones" | "Mi perfil";
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

// Tipo unificado para cards de carga (mock + DB)
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

const TRUCK_LABEL_CAM: Record<string, string> = {
  camion: "Furgón", semi: "Plataforma", frigorifico: "Refrigerado",
  cisterna: "Cisterna", acoplado: "Granelero", otros: "Otros",
};

function dbLoadToCard(load: Record<string, unknown>): CargaCard {
  const tipoCarga = (load.cargo_type as string) ?? "Carga";
  const titulo = `${tipoCarga} — ${load.pickup_city} → ${load.dropoff_city}`;
  const now = new Date();
  const created = new Date(load.created_at as string);
  const diffH = Math.floor((now.getTime() - created.getTime()) / 3600000);
  const hace = diffH > 24
    ? `Publicado hace ${Math.floor(diffH / 24)} día${Math.floor(diffH / 24) > 1 ? "s" : ""}`
    : diffH > 0 ? `Publicado hace ${diffH} hora${diffH > 1 ? "s" : ""}`
    : "Publicado hace unos minutos";
  const shipper = load.shipper as Record<string, string> | null;
  return {
    id:        (load._id ?? load.id) as string,
    titulo,
    empresa:   shipper?.razon_social ?? "Dador de carga",
    hace,
    precio:    (load.price_base as number) ?? 0,
    peso:      load.weight_kg ? `${(load.weight_kg as number).toLocaleString("es-AR")} kg` : "—",
    camion:    load.truck_type_required ? (TRUCK_LABEL_CAM[load.truck_type_required as string] ?? "Cualquiera") : "Cualquiera",
    retiro:    load.ready_at ? new Date(load.ready_at as string).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—",
    distancia: "—",
    rating:    0,
    viajes:    0,
    badge:     null,
    destacado: false,
  };
}

function SeccionBuscar({
  onOfertar,
  onAlerta,
  excluirIds,
}: {
  onOfertar: (c: ModalOfertaState) => void;
  onAlerta: () => void;
  excluirIds: Set<string | number>;
}) {
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
    fetch("/api/loads/available")
      .then((r) => r.json())
      .then((d) => {
        if (d.loads) setCargasDB(d.loads.map(dbLoadToCard));
      })
      .catch(() => {})
      .finally(() => setLoadingDB(false));
  }, []);

  const toggleChip = (list: string[], setList: (v: string[]) => void, t: string) =>
    setList(list.includes(t) ? list.filter((x) => x !== t) : [...list, t]);

  const parseKm = (d: string) => parseInt(d.replace(/\./g, "").replace(/[^0-9]/g, "")) || 0;

  const DIST_RANGOS: Record<string, [number, number]> = {
    todos:     [0, Infinity],
    corta:     [0, 500],
    media:     [500, 1200],
    larga:     [1200, 2000],
    muy_larga: [2000, Infinity],
  };

  const limpiarFiltros = () => {
    setTipos([]); setTiposCamion([]); setOrigen(""); setDestino("");
    setDistanciaRango("todos"); setPrecioMin(""); setPrecioMax("");
    setFechaDesde(""); setRatingMin("0"); setSoloDestacadas(false);
  };

  const hayFiltros = tipos.length > 0 || tiposCamion.length > 0 || origen || destino ||
    distanciaRango !== "todos" || precioMin || precioMax || fechaDesde || ratingMin !== "0" || soloDestacadas;

  const [minKm, maxKm] = DIST_RANGOS[distanciaRango];

  const todasCargas: CargaCard[] = cargasDB.filter((c) => !excluirIds.has(c.id));

  const cargas = todasCargas
    .filter((c) => {
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
    })
    .sort((a, b) => {
      if (sortBy === "Mayor precio") return b.precio - a.precio;
      if (sortBy === "Menor precio") return a.precio - b.precio;
      if (sortBy === "Más cercano") return parseKm(a.distancia) - parseKm(b.distancia);
      return 0;
    });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", flex: 1 }}>
      {/* Sidebar */}
      <aside style={{ background: "var(--color-background-primary)", borderRight: "0.5px solid var(--color-border-tertiary)", padding: "16px 14px", overflowY: "auto", maxHeight: "calc(100vh - 58px)" }}>

        {/* Header filtros */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>Filtros</div>
          {hayFiltros && (
            <button onClick={limpiarFiltros} style={{ fontSize: 12, color: "var(--color-brand-dark)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}>
              Limpiar todo
            </button>
          )}
        </div>

        {/* Ruta */}
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Ruta</div>
          <input value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Origen..." style={{ ...filterInputStyle, marginBottom: 6 }} />
          <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Destino..." style={filterInputStyle} />
        </div>

        {/* Distancia */}
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Distancia recorrida</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { key: "todos",     label: "Cualquier distancia" },
              { key: "corta",     label: "Hasta 500 km" },
              { key: "media",     label: "500 — 1.200 km" },
              { key: "larga",     label: "1.200 — 2.000 km" },
              { key: "muy_larga", label: "Más de 2.000 km" },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: distanciaRango === key ? "var(--color-brand-dark)" : "var(--color-text-secondary)", fontWeight: distanciaRango === key ? 500 : 400 }}>
                <input type="radio" name="distancia" checked={distanciaRango === key} onChange={() => setDistanciaRango(key)} style={{ accentColor: "var(--color-brand)", cursor: "pointer" }} />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Precio */}
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Precio (ARS)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>Mínimo</div>
              <input type="number" value={precioMin} onChange={(e) => setPrecioMin(e.target.value)} placeholder="0" style={filterInputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>Máximo</div>
              <input type="number" value={precioMax} onChange={(e) => setPrecioMax(e.target.value)} placeholder="∞" style={filterInputStyle} />
            </div>
          </div>
        </div>

        {/* Tipo de carga */}
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Tipo de carga</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {["Granel", "Refrigerado", "General", "Plataforma", "Peligroso", "Frágil"].map((t) => {
              const on = tipos.includes(t);
              return (
                <button key={t} onClick={() => toggleChip(tipos, setTipos, t)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, cursor: "pointer", border: on ? "0.5px solid var(--color-brand)" : "0.5px solid var(--color-border-secondary)", background: on ? "var(--color-brand-light)" : "transparent", color: on ? "var(--color-brand-dark)" : "var(--color-text-secondary)", fontWeight: on ? 500 : 400 }}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tipo de camión */}
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Tipo de camión requerido</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {["Granelero", "Furgón", "Plataforma", "Refrigerado", "Cisterna", "Batea"].map((t) => {
              const on = tiposCamion.includes(t);
              return (
                <button key={t} onClick={() => toggleChip(tiposCamion, setTiposCamion, t)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, cursor: "pointer", border: on ? "0.5px solid var(--color-brand)" : "0.5px solid var(--color-border-secondary)", background: on ? "var(--color-brand-light)" : "transparent", color: on ? "var(--color-brand-dark)" : "var(--color-text-secondary)", fontWeight: on ? 500 : 400 }}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Fecha de retiro desde */}
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Fecha de retiro desde</div>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={filterInputStyle} />
        </div>

        {/* Calificación del dador */}
        <div style={filterGroupStyle}>
          <div style={filterLabelStyle}>Calificación mínima del dador</div>
          <select value={ratingMin} onChange={(e) => setRatingMin(e.target.value)} style={{ ...filterInputStyle, cursor: "pointer" }}>
            <option value="0">Cualquier calificación</option>
            <option value="4">4.0 ★ o más</option>
            <option value="4.5">4.5 ★ o más</option>
            <option value="4.8">4.8 ★ o más</option>
          </select>
        </div>

        {/* Solo destacadas */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={soloDestacadas} onChange={(e) => setSoloDestacadas(e.target.checked)} style={{ accentColor: "var(--color-brand)", width: 14, height: 14, cursor: "pointer" }} />
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Solo cargas destacadas</span>
          </label>
        </div>

        <button onClick={onAlerta} style={{ width: "100%", fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", background: "var(--color-brand)", border: "none", color: "#fff", cursor: "pointer", fontWeight: 500 }}>
          Guardar alerta con estos filtros
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
            {loadingDB ? "Cargando..." : `${cargas.length} cargas encontradas`}
          </span>
        </div>

        {cargas.map((c) => {
          const partes = c.titulo.split(" — ");
          const tipoCarga = partes[0];
          const ruta = partes[1] ?? c.titulo;
          const [origen, destino] = ruta.split(" → ");
          return (
            <div key={c.id} style={{
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderLeft: c.destacado ? "4px solid var(--color-brand)" : "4px solid transparent",
              borderRadius: "var(--border-radius-lg)",
              padding: 16, marginBottom: 10, cursor: "pointer",
            }}>
              {/* Ruta — lo principal */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)" }}>{origen}</span>
                    <span style={{ fontSize: 18, color: "var(--color-brand)", fontWeight: 700 }}>→</span>
                    <span style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)" }}>{destino}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {tipoCarga} · {c.empresa} · {c.hace}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-brand-dark)" }}>${c.precio.toLocaleString("es-AR")}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Precio base</div>
                </div>
              </div>

              {/* Detalles secundarios */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
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
                  style={{ fontSize: 13, padding: "7px 16px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", cursor: "pointer", fontWeight: 600 }}
                >
                  Ofertar →
                </button>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}

interface MiOferta {
  id: string;
  titulo: string;
  empresa: string;
  precioBase: number;
  miOferta: number;
  fecha: string;
  estado: "pending" | "countered" | "accepted" | "rejected";
  counterPrice: number | null;
  nota: string;
}

function SeccionMisOfertas({ onToast }: { onToast: (m: string) => void }) {
  const [ofertas, setOfertas] = useState<MiOferta[]>([]);
  const [loading, setLoading] = useState(true);
  const [accionando, setAccionando] = useState<string | null>(null);

  const fetchOfertas = () => {
    setLoading(true);
    fetch("/api/offers/mine")
      .then((r) => r.json())
      .then((d) => { if (d.offers) setOfertas(d.offers); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOfertas(); }, []);

  const accion = async (offerId: string, action: string) => {
    setAccionando(offerId + action);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        if (action === "withdraw") onToast("Oferta retirada.");
        else if (action === "accept_counter") onToast("Contraoferta aceptada. ¡El viaje está confirmado!");
        else if (action === "reject_counter") onToast("Contraoferta rechazada.");
        fetchOfertas();
      }
    } finally {
      setAccionando(null);
    }
  };

  const estadoLabel: Record<string, string> = {
    pending:  "Pendiente",
    countered: "Contraoferta recibida",
    accepted: "Aceptada",
    rejected: "Rechazada",
  };
  const estadoStyle: Record<string, { bg: string; color: string }> = {
    pending:   { bg: "#fef3c7", color: "#92400e" },
    countered: { bg: "#eff6ff", color: "#1d4ed8" },
    accepted:  { bg: "var(--color-brand-light)", color: "var(--color-brand-dark)" },
    rejected:  { bg: "#fee2e2", color: "#b91c1c" },
  };

  return (
    <main style={{ padding: 20, flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 16 }}>Mis ofertas</div>
      {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
      {!loading && ofertas.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>No enviaste ofertas todavía.</div>
      )}
      {!loading && ofertas.map((o) => (
        <div key={o.id} style={{ background: "var(--color-background-primary)", border: o.estado === "countered" ? "1.5px solid #3b82f6" : "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{o.titulo}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{o.empresa} · {o.fecha}</div>
            </div>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: estadoStyle[o.estado]?.bg, color: estadoStyle[o.estado]?.color }}>{estadoLabel[o.estado]}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>Precio base del dador</div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{o.precioBase ? `$${o.precioBase.toLocaleString("es-AR")}` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>Tu oferta</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-brand-dark)" }}>${o.miOferta.toLocaleString("es-AR")}</div>
            </div>
          </div>

          {/* Contraoferta del dador */}
          {o.estado === "countered" && o.counterPrice != null && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "#eff6ff", borderRadius: "var(--border-radius-md)", border: "1px solid #bfdbfe" }}>
              <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 600, marginBottom: 8 }}>
                El dador propuso un nuevo precio: <span style={{ fontSize: 15 }}>${o.counterPrice.toLocaleString("es-AR")}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => accion(o.id, "accept_counter")}
                  disabled={accionando === o.id + "accept_counter"}
                  style={{ flex: 1, padding: "8px 0", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: accionando === o.id + "accept_counter" ? 0.6 : 1 }}
                >
                  Aceptar contraoferta
                </button>
                <button
                  onClick={() => accion(o.id, "reject_counter")}
                  disabled={accionando === o.id + "reject_counter"}
                  style={{ flex: 1, padding: "8px 0", borderRadius: "var(--border-radius-md)", border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: accionando === o.id + "reject_counter" ? 0.6 : 1 }}
                >
                  Rechazar
                </button>
              </div>
            </div>
          )}

          {o.nota && (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 10, padding: "8px 10px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)" }}>
              &ldquo;{o.nota}&rdquo;
            </div>
          )}

          {/* Retirar oferta */}
          {(o.estado === "pending" || o.estado === "countered") && (
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => accion(o.id, "withdraw")}
                disabled={accionando === o.id + "withdraw"}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "none", color: "var(--color-text-tertiary)", cursor: "pointer", opacity: accionando === o.id + "withdraw" ? 0.5 : 1 }}
              >
                Retirar oferta
              </button>
            </div>
          )}
        </div>
      ))}
    </main>
  );
}

type TabViajes = "En curso" | "Próximos" | "Completados";

function Calendario({ eventos }: { eventos: { fecha: string; tipo: "salida" | "llegada"; titulo: string }[] }) {
  const [base, setBase] = useState(() => new Date(2026, 3, 1)); // Abril 2026
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Lun=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const eventMap: Record<number, { tipo: "salida" | "llegada"; titulo: string }[]> = {};
  eventos.forEach(({ fecha, tipo, titulo }) => {
    const [d, m, y] = fecha.split("/").map(Number);
    if (m - 1 === month && y === year) {
      if (!eventMap[d]) eventMap[d] = [];
      eventMap[d].push({ tipo, titulo });
    }
  });

  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => setBase(new Date(year, month - 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--color-text-secondary)", padding: "2px 6px" }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{MESES[month]} {year}</span>
        <button onClick={() => setBase(new Date(year, month + 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--color-text-secondary)", padding: "2px 6px" }}>›</button>
      </div>

      {/* Días de la semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
        {["Lu","Ma","Mi","Ju","Vi","Sa","Do"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, color: "var(--color-text-tertiary)", fontWeight: 500, padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Grilla */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          const evs = day ? eventMap[day] : null;
          const hasSalida = evs?.some((e) => e.tipo === "salida");
          const hasLlegada = evs?.some((e) => e.tipo === "llegada");
          return (
            <div key={i} title={evs?.map((e) => `${e.tipo === "salida" ? "Salida" : "Llegada"}: ${e.titulo}`).join("\n")} style={{
              height: 34, borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: evs ? "var(--color-brand-light)" : "transparent",
              border: evs ? "0.5px solid var(--color-brand)" : "none",
              cursor: evs ? "pointer" : "default",
            }}>
              {day && <span style={{ fontSize: 12, fontWeight: evs ? 600 : 400, color: evs ? "var(--color-brand-dark)" : "var(--color-text-secondary)" }}>{day}</span>}
              {(hasSalida || hasLlegada) && (
                <div style={{ display: "flex", gap: 2, marginTop: 1 }}>
                  {hasSalida && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-brand)" }} />}
                  {hasLlegada && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#3b82f6" }} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", gap: 14, marginTop: 14, paddingTop: 12, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-text-tertiary)" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-brand)" }} /> Salida
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-text-tertiary)" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6" }} /> Llegada
        </div>
      </div>
    </div>
  );
}

function SeccionMisViajes() {
  const [tab, setTab] = useState<TabViajes>("En curso");

  return (
    <main style={{ padding: "20px 24px", flex: 1 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 16 }}>Mis viajes</div>

      {/* Tab cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        {([
          { t: "En curso" as TabViajes,    icon: "🚛", color: "#f59e0b", bg: "#fffbeb", count: 0, desc: "Viaje activo ahora" },
          { t: "Próximos" as TabViajes,    icon: "📅", color: "#3b82f6", bg: "#eff6ff", count: 0, desc: "Confirmados" },
          { t: "Completados" as TabViajes, icon: "✓",  color: "#16a34a", bg: "#f0fdf4", count: 0, desc: "Historial" },
        ]).map(({ t, icon, color, bg, count, desc }) => (
          <button key={t} onClick={() => setTab(t)} style={{
            border: tab === t ? `2px solid ${color}` : "1.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            background: tab === t ? bg : "var(--color-background-primary)",
            padding: "18px 20px",
            cursor: "pointer",
            textAlign: "left" as const,
            transition: "all 0.15s",
            boxShadow: tab === t ? `0 2px 12px ${color}33` : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--border-radius-md)", background: tab === t ? color : "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transition: "all 0.15s" }}>{icon}</div>
              <span style={{ fontSize: 30, fontWeight: 700, color: tab === t ? color : "var(--color-text-primary)", lineHeight: 1 }}>{count}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: tab === t ? color : "var(--color-text-primary)", marginBottom: 3 }}>{t}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{desc}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
        <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14, background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}>
          No tenés viajes en esta categoría todavía.
        </div>
        <Calendario eventos={[]} />
      </div>
    </main>
  );
}

interface Conversacion { offerId: string; cargaTitulo: string; otherUserName: string; precio: number; lastMessage: string | null; lastMessageTime: string | null; }
interface MensajeChat { id: string; senderId: string; texto: string; hora: string; }

function ChatCamionero({ conv, userId, onVolver }: { conv: Conversacion; userId: string; onVolver: () => void }) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/messages?offerId=${conv.offerId}`)
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
  }, [conv.offerId]);

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: conv.offerId, content: texto.trim() }),
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
    <main style={{ padding: "28px 32px", flex: 1, maxWidth: 760 }}>
      <button onClick={onVolver} style={{ fontSize: 13, color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer", marginBottom: 16, padding: 0 }}>← Volver a mensajes</button>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>{conv.otherUserName}</div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>{conv.cargaTitulo} · ${conv.precio.toLocaleString("es-AR")}</div>
      <div style={{ background: "var(--color-brand-light)", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "var(--color-brand-dark)", fontWeight: 500 }}>
        🚛 {conv.cargaTitulo} · ${conv.precio.toLocaleString("es-AR")} · Pago en escrow
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
    </main>
  );
}

function SeccionMensajes({ userId }: { userId: string }) {
  const [convs, setConvs]           = useState<Conversacion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [chatAbierto, setChatAbierto] = useState<Conversacion | null>(null);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => { if (d.conversations) setConvs(d.conversations); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (chatAbierto) {
    return <ChatCamionero conv={chatAbierto} userId={userId} onVolver={() => setChatAbierto(null)} />;
  }

  return (
    <main style={{ padding: "28px 32px", flex: 1, maxWidth: 760 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 20 }}>Mensajes</div>
      {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: 14 }}>Cargando...</div>}
      {!loading && convs.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-text-tertiary)", fontSize: 14, background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✉</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>No tenés mensajes todavía</div>
          <div>Los chats con dadores de carga aparecerán aquí una vez que se acepte una oferta.</div>
        </div>
      )}
      {!loading && convs.map((c) => (
        <button
          key={c.offerId}
          onClick={() => setChatAbierto(c)}
          style={{ width: "100%", textAlign: "left", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "14px 16px", marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
        >
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "var(--color-brand-dark)", flexShrink: 0 }}>
            {c.otherUserName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{c.otherUserName}</div>
              {c.lastMessageTime && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{c.lastMessageTime}</div>}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.cargaTitulo}</div>
            {c.lastMessage && <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{c.lastMessage}</div>}
          </div>
        </button>
      ))}
    </main>
  );
}


function SeccionNotificaciones() {
  return (
    <main style={{ padding: "28px 32px", flex: 1, maxWidth: 760 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 20 }}>Notificaciones</div>
      <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-text-tertiary)", fontSize: 14, background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🔔</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>No tenés notificaciones</div>
        <div>Las notificaciones de ofertas, pagos y viajes aparecerán aquí.</div>
      </div>
    </main>
  );
}

const EARNINGS_DATA = [
  { mes: "Oct", monto: 180000 },
  { mes: "Nov", monto: 220000 },
  { mes: "Dic", monto: 195000 },
  { mes: "Ene", monto: 310000 },
  { mes: "Feb", monto: 275000 },
  { mes: "Mar", monto: 400000 },
];

const CARGO_TYPES = [
  { tipo: "Granos",       pct: 45, color: "#16a34a" },
  { tipo: "Fertilizantes", pct: 25, color: "#3b82f6" },
  { tipo: "Líquidos",      pct: 18, color: "#f59e0b" },
  { tipo: "Otros",         pct: 12, color: "#8b5cf6" },
];

const TOP_ROUTES = [
  { ruta: "Córdoba → Mendoza",      viajes: 22, km: "790 km" },
  { ruta: "Rosario → Buenos Aires", viajes: 18, km: "300 km" },
  { ruta: "Rosario → Córdoba",      viajes: 15, km: "390 km" },
  { ruta: "Buenos Aires → Tandil",  viajes: 9,  km: "360 km" },
];

type TabPerfil = "Perfil" | "Estadísticas";

function SeccionPerfil({ onToast, userName, userEmail, rolLabel }: {
  onToast: (m: string) => void;
  userName: string;
  userEmail: string;
  rolLabel: string;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(userName);
  const [telefono, setTelefono] = useState("+54 9 11 4523-7891");
  const [tabPerfil, setTabPerfil] = useState<TabPerfil>("Perfil");
  const initials = nombre.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
  const maxEarning = Math.max(...EARNINGS_DATA.map((e) => e.monto));

  return (
    <main style={{ flex: 1, background: "var(--color-background-tertiary)" }}>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #16301a 0%, #1e4a24 100%)", padding: "36px 40px 52px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24, maxWidth: 800 }}>
          <div style={{ width: 84, height: 84, borderRadius: "50%", background: "var(--color-brand)", border: "3px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1 }}>
            {editando
              ? <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ fontSize: 24, fontWeight: 700, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "var(--border-radius-md)", padding: "4px 10px", color: "#fff", outline: "none", width: "100%", maxWidth: 300 }} />
              : <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{nombre}</div>
            }
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>{rolLabel}</span>
              <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 500 }}>✓ Verificado</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{userEmail}</div>
          </div>
          {tabPerfil === "Perfil" && (
            <button
              onClick={() => { if (editando) onToast("Perfil actualizado."); setEditando(!editando); }}
              style={{ fontSize: 13, padding: "9px 18px", borderRadius: "var(--border-radius-md)", background: editando ? "var(--color-brand)" : "rgba(255,255,255,0.12)", border: editando ? "none" : "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontWeight: 500, flexShrink: 0 }}
            >
              {editando ? "Guardar cambios" : "Editar perfil"}
            </button>
          )}
        </div>
      </div>

      {/* Stats banner */}
      <div style={{ padding: "0 40px", marginTop: -28, maxWidth: 840 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          {[["4.8 ⭐", "Calificación promedio"], ["127", "Viajes completados"], ["Mar 2024", "En plataforma desde"]].map(([val, label], idx, arr) => (
            <div key={label} style={{ padding: "20px 0", textAlign: "center", borderRight: idx < arr.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)" }}>{val}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ padding: "22px 40px 0", maxWidth: 840 }}>
        <div style={{ display: "inline-flex", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: 3, gap: 2 }}>
          {(["Perfil", "Estadísticas"] as TabPerfil[]).map((t) => (
            <button key={t} onClick={() => setTabPerfil(t)} style={{
              fontSize: 14, padding: "8px 22px", borderRadius: "var(--border-radius-md)", border: "none", cursor: "pointer",
              background: tabPerfil === t ? "var(--color-background-primary)" : "transparent",
              color: tabPerfil === t ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              fontWeight: tabPerfil === t ? 600 : 400,
              boxShadow: tabPerfil === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* ── TAB: PERFIL ── */}
      {tabPerfil === "Perfil" && (
        <div style={{ padding: "20px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 840 }}>

          {/* Camión */}
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🚛</span> Datos del camión
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[["Tipo", "Granelero"], ["Marca / Modelo", "Scania R 450"], ["Año", "2021"], ["Patente", "AB 123 CD"], ["Capacidad", "30.000 kg"]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contacto + acciones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 24, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>📋</span> Contacto
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Teléfono</div>
                  {editando
                    ? <input value={telefono} onChange={(e) => setTelefono(e.target.value)} style={{ fontSize: 14, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", padding: "7px 10px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", width: "100%", boxSizing: "border-box" as const }} />
                    : <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{telefono}</div>
                  }
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Email</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{userEmail || "—"}</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              style={{ fontSize: 13, padding: "12px", borderRadius: "var(--border-radius-lg)", border: "0.5px solid #fecaca", background: "#fef2f2", color: "#b91c1c", cursor: "pointer", fontWeight: 500 }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: ESTADÍSTICAS ── */}
      {tabPerfil === "Estadísticas" && (
        <div style={{ padding: "20px 40px 32px", maxWidth: 840 }}>

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { val: "$1.580.000", label: "Ingresos últimos 6 meses", color: "#16a34a" },
              { val: "38.700 km", label: "KMs recorridos",            color: "#3b82f6" },
              { val: "$12.440",   label: "Ingreso promedio / km",     color: "#f59e0b" },
              { val: "64 viajes", label: "Viajes últimos 6 meses",    color: "#8b5cf6" },
            ].map(({ val, label, color }) => (
              <div key={label} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px 18px" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color, marginBottom: 4 }}>{val}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", lineHeight: 1.4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Gráfico ingresos + tipos de carga */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

            {/* Bar chart ingresos */}
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 18 }}>Ingresos mensuales</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 110 }}>
                {EARNINGS_DATA.map((e) => {
                  const heightPct = (e.monto / maxEarning) * 100;
                  const isMax = e.monto === maxEarning;
                  return (
                    <div key={e.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                      <div style={{ fontSize: 10, color: isMax ? "var(--color-brand-dark)" : "var(--color-text-tertiary)", fontWeight: isMax ? 700 : 400 }}>
                        ${(e.monto / 1000).toFixed(0)}k
                      </div>
                      <div style={{ width: "100%", height: `${heightPct}%`, background: isMax ? "var(--color-brand)" : "var(--color-brand-light)", borderRadius: "4px 4px 0 0", transition: "height 0.3s", minHeight: 4 }} />
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{e.mes}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tipos de carga */}
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 18 }}>Tipos de carga transportada</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {CARGO_TYPES.map((c) => (
                  <div key={c.tipo}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{c.tipo}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{c.pct}%</span>
                    </div>
                    <div style={{ height: 8, background: "var(--color-background-secondary)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${c.pct}%`, background: c.color, borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rutas más frecuentes */}
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>Rutas más frecuentes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {TOP_ROUTES.map((r, i) => (
                <div key={r.ruta} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < TOP_ROUTES.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-brand-light)", color: "var(--color-brand-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{r.ruta}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{r.km}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-brand-dark)" }}>{r.viajes}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>viajes</div>
                  </div>
                  <div style={{ width: 80, height: 6, background: "var(--color-background-secondary)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(r.viajes / TOP_ROUTES[0].viajes) * 100}%`, background: "var(--color-brand)", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </main>
  );
}

// ── Modal Ofertar ─────────────────────────────────────────────────────────────

function ModalOfertar({ info, onClose, onEnviar }: {
  info: ModalOfertaState;
  onClose: () => void;
  onEnviar: (cargaId: string | number) => void;
}) {
  const [precio, setPrecio] = useState(info.precioBase.toString());
  const [nota, setNota] = useState("");
  const [disponible, setDisponible] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const diferencia = parseInt(precio || "0") - info.precioBase;
  const diff = isNaN(diferencia) ? 0 : diferencia;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loadId: info.cargaId,
          price:  precio,
          note:   [nota, disponible].filter(Boolean).join(" — ") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al enviar la oferta."); return; }
      onEnviar(info.cargaId);
      onClose();
    } finally {
      setLoading(false);
    }
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

        {error && <div style={{ fontSize: 13, color: "#b91c1c", background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>
            Cancelar
          </button>
          <button type="submit" disabled={loading} style={{ flex: 2, fontSize: 13, padding: "9px", borderRadius: "var(--border-radius-md)", border: "none", background: loading ? "#aaa" : "var(--color-brand)", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}>
            {loading ? "Enviando..." : "Enviar oferta →"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CamioneroDashboard() {
  const { data: session } = useSession();
  const [navActivo, setNavActivo] = useState<NavItem>("Buscar cargas");
  const [modalOferta, setModalOferta] = useState<ModalOfertaState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ofertadasIds, setOfertadasIds] = useState<Set<string | number>>(new Set());

  const userName = session?.user?.name ?? "Usuario";
  const userEmail = session?.user?.email ?? "";
  const userId    = session?.user?.id    ?? "";
  const userRole = session?.user?.role ?? "camionero";
  const rolLabel = userRole === "flota" ? "Empresa de flota" : "Camionero independiente";
  // Iniciales a partir del nombre real
  const initials = userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
  const primerNombre = userName.split(" ")[0];

  const mostrarToast = (msg: string) => setToast(msg);

  return (
    <div style={{ background: "var(--color-background-primary)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Topbar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 58, background: "#16301a", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Link href="/" style={{ fontSize: 18, fontWeight: 700, color: "#fff", textDecoration: "none", letterSpacing: "-0.01em" }}>
            Carga<span style={{ color: "var(--color-brand)" }}>Back</span>
          </Link>
          <nav style={{ display: "flex", gap: 2 }}>
            {(["Buscar cargas", "Mis ofertas", "Mis viajes", "Mensajes", "Notificaciones"] as NavItem[]).map((item) => (
              <button key={item} onClick={() => setNavActivo(item)} style={{
                fontSize: 16, padding: "9px 16px", borderRadius: "var(--border-radius-md)",
                border: "none", cursor: "pointer",
                background: navActivo === item ? "rgba(255,255,255,0.14)" : "transparent",
                color: navActivo === item ? "#fff" : "rgba(255,255,255,0.62)",
                fontWeight: navActivo === item ? 600 : 400,
                letterSpacing: navActivo === item ? "-0.01em" : "normal",
              }}>
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{primerNombre}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{rolLabel}</span>
          </div>
          <button
            onClick={() => setNavActivo("Mi perfil")}
            title="Ver mi perfil"
            style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-brand)", border: "2px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}
          >{initials}</button>
        </div>
      </header>

      {/* Contenido según nav */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--color-background-tertiary)" }}>
        {navActivo === "Buscar cargas" && (
          <SeccionBuscar
            onOfertar={(c) => setModalOferta(c)}
            onAlerta={() => mostrarToast("¡Alerta guardada! Te avisamos cuando aparezca una carga que te interese.")}
            excluirIds={ofertadasIds}
          />
        )}
        {navActivo === "Mis ofertas" && <SeccionMisOfertas onToast={mostrarToast} />}
        {navActivo === "Mis viajes" && <SeccionMisViajes />}
        {navActivo === "Mensajes" && <SeccionMensajes userId={userId} />}
        {navActivo === "Notificaciones" && <SeccionNotificaciones />}
        {navActivo === "Mi perfil" && <SeccionPerfil onToast={mostrarToast} userName={userName} userEmail={userEmail} rolLabel={rolLabel} />}
      </div>

      {/* Modal ofertar */}
      {modalOferta && (
        <ModalOfertar
          info={modalOferta}
          onClose={() => setModalOferta(null)}
          onEnviar={(cargaId) => {
            setOfertadasIds((prev) => new Set([...prev, cargaId]));
            mostrarToast("¡Oferta enviada! El dador recibirá tu propuesta.");
          }}
        />
      )}

      {/* Toast */}
      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Estilos auxiliares ────────────────────────────────────────────────────────
const filterLabelStyle: React.CSSProperties = {
  fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 8,
  textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500,
};
const filterInputStyle: React.CSSProperties = {
  width: "100%", fontSize: 13, padding: "7px 10px",
  borderRadius: "var(--border-radius-md)",
  border: "0.5px solid var(--color-border-secondary)",
  background: "var(--color-background-secondary)",
  color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box",
};
const filterGroupStyle: React.CSSProperties = {
  marginBottom: 20,
  paddingBottom: 20,
  borderBottom: "0.5px solid var(--color-border-tertiary)",
};
