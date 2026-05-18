"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

const TRUCK_ICON: Record<string, string> = {
  camion:      "/trucks/Camion.svg",
  semi:        "/trucks/Semi.svg",
  frigorifico: "/trucks/Frigorifico.svg",
  cisterna:    "/trucks/Cisterna.svg",
  acoplado:    "/trucks/Trailer.svg",
  batea:       "/trucks/Batea.svg",
};
const DEFAULT_TRUCK_ICON = "/trucks/Camion.svg";

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

interface TripMapProps {
  loadId: string;
  originLat?: number | null;
  originLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
  height?: number;
  isDriver?: boolean;
  truckType?: string | null;
}

export default function TripMap({
  loadId,
  originLat,
  originLng,
  destLat,
  destLng,
  height = 280,
  isDriver = false,
  truckType,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const truckMarkerRef = useRef<any>(null);
  const esRef = useRef<EventSource | null>(null);
  const watchIdRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gasMarkersRef = useRef<any[]>([]);
  const lastGasUpdatePosRef = useRef<[number, number] | null>(null);
  const showGasRef = useRef(false);
  const updateGasStationsRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const currentTruckPosRef = useRef<[number, number] | null>(null);
  const [showGasStations, setShowGasStations] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    import("maplibre-gl").then((ml) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maplibregl: any = ml.default ?? ml;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current!,
        style: OPENFREEMAP_STYLE,
        center: [-58.3816, -34.6037],
        zoom: 5,
      });
      mapRef.current = map;

      const truckIconSrc = TRUCK_ICON[truckType ?? ""] ?? DEFAULT_TRUCK_ICON;

      const GAS_RADIUS_M = 15000;
      const GAS_UPDATE_DIST = 0.045;

      const updateGasStations = (lat: number, lng: number) => {
        if (lastGasUpdatePosRef.current) {
          const [prevLat, prevLng] = lastGasUpdatePosRef.current;
          const d = Math.sqrt((lat - prevLat) ** 2 + (lng - prevLng) ** 2);
          if (d < GAS_UPDATE_DIST) return;
        }
        lastGasUpdatePosRef.current = [lat, lng];

        const query = `[out:json][timeout:15];(node[amenity=fuel](around:${GAS_RADIUS_M},${lat},${lng});way[amenity=fuel](around:${GAS_RADIUS_M},${lat},${lng}););out center;`;
        const OVERPASS_MIRRORS = [
          "https://overpass-api.de/api/interpreter",
          "https://overpass.kumi.systems/api/interpreter",
          "https://overpass.osm.ch/api/interpreter",
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fetchWithFallback = async (): Promise<any> => {
          for (const mirror of OVERPASS_MIRRORS) {
            try {
              const r = await fetch(`${mirror}?data=${encodeURIComponent(query)}`);
              if (r.ok) return r.json();
            } catch {}
          }
          return null;
        };

        fetchWithFallback()
          .then((data) => {
            if (!data || !mapRef.current) return;
            gasMarkersRef.current.forEach((m) => m.remove());
            gasMarkersRef.current = [];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (data.elements ?? []).forEach((el: any) => {
              const elLat = el.lat ?? el.center?.lat;
              const elLng = el.lon ?? el.center?.lon;
              if (!elLat || !elLng) return;
              const name = el.tags?.name ?? el.tags?.brand ?? "Estación de servicio";

              const markerEl = document.createElement("div");
              markerEl.style.cssText =
                "width:26px;height:26px;background:#f59e0b;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:pointer";
              markerEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15"/><path d="M14 7h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 1 1 0 0 1 1 1v5a1 1 0 0 1-1 1 3 3 0 0 1-3-3V9"/><rect x="3" y="11" width="11" height="5" rx="1"/><line x1="3" y1="22" x2="17" y2="22"/></svg>`;

              const marker = new maplibregl.Marker({ element: markerEl })
                .setLngLat([elLng, elLat])
                .setPopup(new maplibregl.Popup().setHTML(`<strong>${name}</strong>`))
                .addTo(map);
              gasMarkersRef.current.push(marker);
            });
          })
          .catch(() => {});
      };

      updateGasStationsRef.current = updateGasStations;

      const moveTruck = (lat: number, lng: number) => {
        if (!truckMarkerRef.current) {
          const el = document.createElement("div");
          el.style.cssText =
            "width:33px;height:33px;overflow:hidden;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))";
          el.innerHTML = `<img src="${truckIconSrc}" style="width:33px;height:33px;display:block;object-fit:contain;filter:brightness(0) saturate(100%) invert(43%) sepia(18%) saturate(1000%) hue-rotate(124deg) brightness(82%)" />`;
          truckMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(new maplibregl.Popup().setHTML("Camión en tránsito"))
            .addTo(map);
        } else {
          truckMarkerRef.current.setLngLat([lng, lat]);
        }
        map.easeTo({ center: [lng, lat] });
        currentTruckPosRef.current = [lat, lng];
        if (showGasRef.current) updateGasStations(lat, lng);
      };

      map.on("load", () => {
        if (cancelled) return;

        // Marcador de origen (verde)
        if (originLat && originLng) {
          const el = document.createElement("div");
          el.style.cssText =
            "width:16px;height:16px;background:#16a34a;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)";
          new maplibregl.Marker({ element: el })
            .setLngLat([originLng, originLat])
            .setPopup(new maplibregl.Popup().setHTML("Origen"))
            .addTo(map);
        }

        // Marcador de destino (azul)
        if (destLat && destLng) {
          const el = document.createElement("div");
          el.style.cssText =
            "width:16px;height:16px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)";
          new maplibregl.Marker({ element: el })
            .setLngLat([destLng, destLat])
            .setPopup(new maplibregl.Popup().setHTML("Destino"))
            .addTo(map);
        }

        // Ajustar bounds si tenemos origen y destino
        if (originLat && originLng && destLat && destLng) {
          map.fitBounds(
            [
              [Math.min(originLng, destLng), Math.min(originLat, destLat)],
              [Math.max(originLng, destLng), Math.max(originLat, destLat)],
            ],
            { padding: 40 }
          );
        } else if (originLat && originLng) {
          map.setCenter([originLng, originLat]);
          map.setZoom(9);
        }

        // Carga la última posición conocida
        fetch(`/api/location/${loadId}/last`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.lat && data?.lng) {
              moveTruck(Number(data.lat), Number(data.lng));
              if (data.updated_at) setLastUpdate(new Date(data.updated_at));
            }
          })
          .catch(() => {});

        // Conecta al stream SSE para actualizaciones en tiempo real
        const es = new EventSource(`/api/location/${loadId}/stream`);
        esRef.current = es;
        es.onmessage = (event) => {
          try {
            const { lat, lng } = JSON.parse(event.data);
            moveTruck(Number(lat), Number(lng));
            setLastUpdate(new Date());
          } catch {}
        };
      });
    });

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
      gasMarkersRef.current.forEach((m) => m.remove());
      gasMarkersRef.current = [];
      lastGasUpdatePosRef.current = null;
      showGasRef.current = false;
      updateGasStationsRef.current = null;
      currentTruckPosRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      truckMarkerRef.current = null;
    };
  }, [loadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const GAS_RADIUS_KM = 15;

  const toggleGasStations = () => {
    const next = !showGasStations;
    showGasRef.current = next;
    setShowGasStations(next);
    if (!next) {
      gasMarkersRef.current.forEach((m) => m.remove());
      gasMarkersRef.current = [];
      lastGasUpdatePosRef.current = null;
      return;
    }
    const query = updateGasStationsRef.current;
    if (!query) return;
    const pos = currentTruckPosRef.current;
    if (pos) {
      lastGasUpdatePosRef.current = null;
      query(pos[0], pos[1]);
    } else if (originLat != null && originLng != null) {
      query(originLat, originLng);
    }
  };

  const startSharing = () => {
    if (!("geolocation" in navigator)) {
      alert("Geolocalización no disponible en este dispositivo.");
      return;
    }
    setSharing(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await fetch(`/api/location/${loadId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
        } catch {}
      },
      () => setSharing(false),
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 10000 }
    );
  };

  const stopSharing = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
  };

  const formatLastUpdate = (date: Date) => {
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return `hace ${diffSec} seg`;
    if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)} min`;
    return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div>
      <div
        ref={containerRef}
        style={{ height, borderRadius: 8, overflow: "hidden", zIndex: 0 }}
      />
      <div style={{ marginTop: 6, fontSize: 11, color: "var(--color-text-tertiary, #9ca3af)" }}>
        {lastUpdate
          ? `Última actualización: ${formatLastUpdate(lastUpdate)}`
          : "Sin ubicación registrada aún"}
      </div>
      <div style={{ marginTop: 8 }}>
        <button
          onClick={toggleGasStations}
          style={{
            width: "100%",
            fontSize: 12,
            padding: "7px 14px",
            borderRadius: 7,
            border: "none",
            background: showGasStations ? "#f59e0b" : "#e5e7eb",
            color: showGasStations ? "#fff" : "#374151",
            cursor: "pointer",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 22V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15"/>
              <path d="M14 7h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 1 1 0 0 1 1 1v5a1 1 0 0 1-1 1 3 3 0 0 1-3-3V9"/>
              <rect x="3" y="11" width="11" height="5" rx="1"/>
              <line x1="3" y1="22" x2="17" y2="22"/>
            </svg>
            Estaciones de servicio cercanas
          </span>
          <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.75 }}>
            Radio {GAS_RADIUS_KM} km
          </span>
        </button>
      </div>
      {isDriver && (
        <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={sharing ? stopSharing : startSharing}
            style={{
              fontSize: 12,
              padding: "6px 16px",
              borderRadius: 7,
              border: "none",
              background: sharing ? "#dc2626" : "#3a806b",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {sharing ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                Detener ubicación
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Compartir ubicación
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
