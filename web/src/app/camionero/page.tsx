"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";

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

const VIAJES_PROXIMOS = [
  { id: 3, titulo: "Granos — Rosario → Córdoba", empresa: "Acopios Del Norte", precio: 210000, salida: "02/04/2026", llegadaEstimada: "02/04/2026", km: "390 km", camion: "Granelero", etapa: "Confirmado" },
  { id: 4, titulo: "Vinos — Mendoza → Buenos Aires", empresa: "Bodega Clos de Chacras", precio: 285000, salida: "05/04/2026", llegadaEstimada: "06/04/2026", km: "1.040 km", camion: "Furgón", etapa: "Confirmado" },
  { id: 5, titulo: "Materiales — San Juan → Tucumán", empresa: "Constructora Andina", precio: 340000, salida: "10/04/2026", llegadaEstimada: "11/04/2026", km: "870 km", camion: "Plataforma", etapa: "Pendiente confirmación" },
];

const VIAJES_COMPLETADOS = [
  { id: 6, titulo: "Fertilizantes — Córdoba → Mendoza", empresa: "AgroQuímica Del Centro", precio: 400000, salida: "10/03/2026", llegadaEstimada: "12/03/2026", km: "780 km", rating: 5 },
  { id: 7, titulo: "Electrodomésticos — Rosario → Tucumán", empresa: "Importadora Sur", precio: 310000, salida: "22/02/2026", llegadaEstimada: "24/02/2026", km: "1.050 km", rating: 4 },
  { id: 8, titulo: "Granos — Buenos Aires → Rosario", empresa: "Empresa Agro San Martín", precio: 250000, salida: "05/02/2026", llegadaEstimada: "05/02/2026", km: "320 km", rating: 5 },
  { id: 9, titulo: "Fruta — Tucumán → Buenos Aires", empresa: "Finca Los Nogales", precio: 295000, salida: "18/01/2026", llegadaEstimada: "20/01/2026", km: "1.100 km", rating: 5 },
];

// ── Tipos ────────────────────────────────────────────────────────────────────

type NavItem = "Buscar cargas" | "Mis ofertas" | "Mis viajes" | "Notificaciones" | "Mi perfil";
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
    retiro:    load.ready_at ? new Date(load.ready_at as string).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—",
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
}: {
  onOfertar: (c: ModalOfertaState) => void;
  onAlerta: () => void;
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

  const todasCargas: CargaCard[] = cargasDB;

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

  const eventosCalendario = [
    ...EN_CURSO.map((v) => ([
      { fecha: v.salida.split(" ")[0].replace(/\//g, "/"), tipo: "salida" as const, titulo: v.titulo },
      { fecha: v.llegadaEstimada.split(" ")[0].replace(/\//g, "/"), tipo: "llegada" as const, titulo: v.titulo },
    ])).flat(),
    ...VIAJES_PROXIMOS.map((v) => ([
      { fecha: v.salida, tipo: "salida" as const, titulo: v.titulo },
      { fecha: v.llegadaEstimada, tipo: "llegada" as const, titulo: v.titulo },
    ])).flat(),
  ];

  const ETAPA_STYLE: Record<string, { bg: string; color: string }> = {
    "En camino":              { bg: "var(--color-brand-light)", color: "var(--color-brand-dark)" },
    "Cargando":               { bg: "#faeeda", color: "#854f0b" },
    "Confirmado":             { bg: "#dbeafe", color: "#1d4ed8" },
    "Pendiente confirmación": { bg: "#f3e8ff", color: "#7e22ce" },
  };

  return (
    <main style={{ padding: "20px 24px", flex: 1 }}>
      {/* Header */}
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 16 }}>Mis viajes</div>

      {/* Tab cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        {([
          { t: "En curso" as TabViajes,    icon: "🚛", color: "#f59e0b", bg: "#fffbeb", count: EN_CURSO.length,          desc: "Viaje activo ahora" },
          { t: "Próximos" as TabViajes,    icon: "📅", color: "#3b82f6", bg: "#eff6ff", count: VIAJES_PROXIMOS.length,   desc: "Confirmados" },
          { t: "Completados" as TabViajes, icon: "✓",  color: "#16a34a", bg: "#f0fdf4", count: VIAJES_COMPLETADOS.length, desc: "Historial" },
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

      {/* Layout: lista + calendario */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
        <div>

          {/* EN CURSO */}
          {tab === "En curso" && EN_CURSO.map((v) => (
            <div key={v.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderLeft: "4px solid var(--color-brand)", borderRadius: "var(--border-radius-lg)", padding: 18, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>{v.titulo.split(" — ")[1] ?? v.titulo}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{v.titulo.split(" — ")[0]} · {v.empresa}</div>
                </div>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: ETAPA_STYLE[v.etapa]?.bg ?? "#eee", color: ETAPA_STYLE[v.etapa]?.color ?? "#333" }}>{v.etapa}</span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Progreso</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-brand-dark)" }}>{v.progreso}%</span>
                </div>
                <div style={{ height: 8, background: "var(--color-background-secondary)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${v.progreso}%`, background: "var(--color-brand)", borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 12 }}>
                {[["Salida", v.salida], ["Llegada est.", v.llegadaEstimada], ["Distancia", v.km], ["Posición", v.coordActual]].map(([l, val]) => (
                  <div key={l}><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>{l}</div><div style={{ fontSize: 12, color: "var(--color-text-primary)" }}>{val}</div></div>
                ))}
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button style={{ fontSize: 12, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>Ver mapa</button>
                <button style={{ fontSize: 12, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>Contactar dador</button>
              </div>
            </div>
          ))}

          {/* PRÓXIMOS */}
          {tab === "Próximos" && VIAJES_PROXIMOS.map((v) => (
            <div key={v.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderLeft: "4px solid #3b82f6", borderRadius: "var(--border-radius-lg)", padding: 18, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>{v.titulo.split(" — ")[1] ?? v.titulo}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{v.titulo.split(" — ")[0]} · {v.empresa}</div>
                </div>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: ETAPA_STYLE[v.etapa]?.bg ?? "#eee", color: ETAPA_STYLE[v.etapa]?.color ?? "#333" }}>{v.etapa}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 12 }}>
                {[["Salida", v.salida], ["Llegada est.", v.llegadaEstimada], ["Distancia", v.km], ["Camión", v.camion]].map(([l, val]) => (
                  <div key={l}><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>{l}</div><div style={{ fontSize: 12, color: "var(--color-text-primary)" }}>{val}</div></div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-brand-dark)" }}>${v.precio.toLocaleString("es-AR")}</div>
                <button style={{ fontSize: 12, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}>Ver detalles</button>
              </div>
            </div>
          ))}

          {/* COMPLETADOS */}
          {tab === "Completados" && VIAJES_COMPLETADOS.map((v) => (
            <div key={v.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderLeft: "4px solid #6b7280", borderRadius: "var(--border-radius-lg)", padding: 18, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>{v.titulo.split(" — ")[1] ?? v.titulo}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{v.titulo.split(" — ")[0]} · {v.empresa}</div>
                </div>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: "var(--color-brand-light)", color: "var(--color-brand-dark)" }}>Completado ✓</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 12 }}>
                {[["Salida", v.salida], ["Llegada", v.llegadaEstimada], ["Distancia", v.km]].map(([l, val]) => (
                  <div key={l}><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>{l}</div><div style={{ fontSize: 12, color: "var(--color-text-primary)" }}>{val}</div></div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>${v.precio.toLocaleString("es-AR")}</div>
                <div style={{ fontSize: 13, color: "#f59e0b" }}>{"★".repeat(v.rating)}{"☆".repeat(5 - v.rating)} {v.rating}/5</div>
              </div>
            </div>
          ))}

        </div>

        {/* Calendario */}
        <Calendario eventos={eventosCalendario} />
      </div>
    </main>
  );
}

const NOTIFICACIONES_DATA = [
  { id: 1,  tipo: "oferta",  titulo: "Oferta aceptada",           cuerpo: "AgroQuímica Del Centro aceptó tu oferta para Fertilizantes — Córdoba → Mendoza.",       hace: "Hace 2 horas",  leida: false },
  { id: 2,  tipo: "viaje",   titulo: "Viaje completado",          cuerpo: "El viaje Fertilizantes — Córdoba → Mendoza fue marcado como entregado.",                  hace: "Hace 3 horas",  leida: false },
  { id: 3,  tipo: "mensaje", titulo: "Nuevo mensaje",             cuerpo: "Transportes Pampeanos te envió un mensaje sobre la carga Granos — Rosario → Córdoba.",    hace: "Hace 5 horas",  leida: false },
  { id: 4,  tipo: "alerta",  titulo: "Vencimiento próximo",       cuerpo: "Tu VTV vence en 12 días (15/04/2026). Renovar a tiempo evita rechazos de carga.",         hace: "Hace 6 horas",  leida: false },
  { id: 5,  tipo: "pago",    titulo: "Pago acreditado",           cuerpo: "Se acreditaron $400.000 por el viaje Fertilizantes — Córdoba → Mendoza.",                 hace: "Hace 1 día",    leida: true  },
  { id: 6,  tipo: "oferta",  titulo: "Contraoferta recibida",     cuerpo: "Del Campo S.A. realizó una contraoferta de $185.000 para Soja — Rosario → Buenos Aires.", hace: "Hace 1 día",    leida: true  },
  { id: 7,  tipo: "sistema", titulo: "3 cargas nuevas",           cuerpo: "Hay 3 cargas nuevas que coinciden con tus rutas habituales. ¡Revisalas ahora!",           hace: "Hace 2 días",   leida: true  },
  { id: 8,  tipo: "viaje",   titulo: "Carga confirmada",          cuerpo: "Granos — Rosario → Córdoba fue confirmada. Salida programada el 02/04/2026.",              hace: "Hace 2 días",   leida: true  },
  { id: 9,  tipo: "pago",    titulo: "Pago pendiente de cobro",   cuerpo: "Tenés $210.000 pendientes de acreditación por el viaje Granos — Rosario → Córdoba.",      hace: "Hace 3 días",   leida: true  },
  { id: 10, tipo: "sistema", titulo: "Calificación recibida",     cuerpo: "AgroExport SA te calificó con 5 estrellas. Tu rating sube a 4.9 ⭐",                      hace: "Hace 4 días",   leida: true  },
];

const NOTIF_COLORS: Record<string, { bg: string; color: string; icon: string }> = {
  oferta:  { bg: "#dcfce7", color: "#15803d", icon: "✓" },
  viaje:   { bg: "#dbeafe", color: "#1d4ed8", icon: "🚛" },
  pago:    { bg: "#fef9c3", color: "#a16207", icon: "$" },
  sistema: { bg: "#f3e8ff", color: "#7e22ce", icon: "★" },
  mensaje: { bg: "#e0f2fe", color: "#0369a1", icon: "✉" },
  alerta:  { bg: "#fff7ed", color: "#c2410c", icon: "⚠" },
};

type FiltroNotif = "Todas" | "Sin leer" | "Pagos";

function SeccionNotificaciones() {
  const [notifs, setNotifs] = useState(NOTIFICACIONES_DATA);
  const [filtro, setFiltro] = useState<FiltroNotif>("Todas");
  const sinLeer = notifs.filter((n) => !n.leida).length;
  const hoy     = notifs.filter((n) => n.hace.includes("hora")).length;

  const notifsFiltradas = notifs.filter((n) => {
    if (filtro === "Sin leer") return !n.leida;
    if (filtro === "Pagos")    return n.tipo === "pago";
    return true;
  });

  return (
    <main style={{ padding: "28px 32px", flex: 1, maxWidth: 760 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)" }}>Notificaciones</div>
        {sinLeer > 0 && (
          <button
            onClick={() => setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })))}
            style={{ fontSize: 13, padding: "7px 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { valor: sinLeer, label: "Sin leer",    color: "#16a34a", bg: "#f0fdf4" },
          { valor: hoy,     label: "Hoy",         color: "#3b82f6", bg: "#eff6ff" },
          { valor: notifs.length, label: "Total", color: "#7e22ce", bg: "#f5f3ff" },
        ].map(({ valor, label, color, bg }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${color}33`, borderRadius: "var(--border-radius-lg)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color }}>{valor}</span>
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.3 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {(["Todas", "Sin leer", "Pagos"] as FiltroNotif[]).map((f) => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            fontSize: 13, padding: "6px 16px", borderRadius: 20, cursor: "pointer",
            border: filtro === f ? "1.5px solid var(--color-brand)" : "0.5px solid var(--color-border-secondary)",
            background: filtro === f ? "var(--color-brand-light)" : "transparent",
            color: filtro === f ? "var(--color-brand-dark)" : "var(--color-text-secondary)",
            fontWeight: filtro === f ? 600 : 400,
          }}>{f}</button>
        ))}
      </div>

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {notifsFiltradas.map((n) => {
          const c = NOTIF_COLORS[n.tipo];
          return (
            <div
              key={n.id}
              onClick={() => setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, leida: true } : x))}
              style={{
                display: "flex", gap: 14, alignItems: "flex-start",
                background: n.leida ? "var(--color-background-primary)" : "#f0faf2",
                border: `0.5px solid ${n.leida ? "var(--color-border-tertiary)" : "#bbf7d0"}`,
                borderRadius: "var(--border-radius-lg)",
                padding: "16px 18px", cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: c.bg, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{c.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: n.leida ? 400 : 600, color: "var(--color-text-primary)" }}>{n.titulo}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginLeft: 12, flexShrink: 0 }}>{n.hace}</div>
                </div>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{n.cuerpo}</div>
              </div>
              {!n.leida && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-brand)", flexShrink: 0, marginTop: 4 }} />}
            </div>
          );
        })}
        {notifsFiltradas.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--color-text-tertiary)", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔔</div>
            No hay notificaciones en esta categoría.
          </div>
        )}
        {filtro === "Todas" && notifs.every((n) => n.leida) && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-text-tertiary)", fontSize: 14 }}>Todo al día ✓</div>
        )}
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
  onEnviar: () => void;
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
      onEnviar();
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

  const userName = session?.user?.name ?? "Usuario";
  const userEmail = session?.user?.email ?? "";
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
            {(["Buscar cargas", "Mis ofertas", "Mis viajes", "Notificaciones"] as NavItem[]).map((item) => (
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
          />
        )}
        {navActivo === "Mis ofertas" && <SeccionMisOfertas onToast={mostrarToast} />}
        {navActivo === "Mis viajes" && <SeccionMisViajes />}
        {navActivo === "Notificaciones" && <SeccionNotificaciones />}
        {navActivo === "Mi perfil" && <SeccionPerfil onToast={mostrarToast} userName={userName} userEmail={userEmail} rolLabel={rolLabel} />}
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
