"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface TripMapProps {
  loadId: string;
  originLat?: number | null;
  originLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
  height?: number;
  isDriver?: boolean;
}

export default function TripMap({
  loadId,
  originLat,
  originLng,
  destLat,
  destLng,
  height = 280,
  isDriver = false,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const truckRef = useRef<any>(null);
  const esRef = useRef<EventSource | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      // Fix Leaflet default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const defaultCenter: [number, number] = [-34.6037, -58.3816];
      const map = L.map(containerRef.current!).setView(defaultCenter, 5);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      // Marcador de origen (verde)
      if (originLat && originLng) {
        L.circleMarker([originLat, originLng], {
          radius: 8,
          fillColor: "#16a34a",
          color: "white",
          weight: 2,
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup("Origen");
      }

      // Marcador de destino (rojo)
      if (destLat && destLng) {
        L.circleMarker([destLat, destLng], {
          radius: 8,
          fillColor: "#dc2626",
          color: "white",
          weight: 2,
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup("Destino");
      }

      // Ajustar bounds si tenemos origen y destino
      if (originLat && originLng && destLat && destLng) {
        map.fitBounds(
          [
            [originLat, originLng],
            [destLat, destLng],
          ],
          { padding: [40, 40] }
        );
      } else if (originLat && originLng) {
        map.setView([originLat, originLng], 9);
      }

      const truckIcon = L.divIcon({
        className: "",
        html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">🚛</div>',
        iconSize: [26, 22],
        iconAnchor: [13, 11],
      });

      const moveTruck = (lat: number, lng: number) => {
        if (!truckRef.current) {
          truckRef.current = L.marker([lat, lng], { icon: truckIcon })
            .addTo(map)
            .bindPopup("Camión en tránsito");
        } else {
          truckRef.current.setLatLng([lat, lng]);
        }
        map.panTo([lat, lng]);
      };

      // Carga la última posición conocida
      fetch(`/api/location/${loadId}/last`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.lat && data?.lng)
            moveTruck(Number(data.lat), Number(data.lng));
        })
        .catch(() => {});

      // Conecta al stream SSE para actualizaciones en tiempo real
      const es = new EventSource(`/api/location/${loadId}/stream`);
      esRef.current = es;
      es.onmessage = (event) => {
        try {
          const { lat, lng } = JSON.parse(event.data);
          moveTruck(Number(lat), Number(lng));
        } catch {}
      };
    });

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      truckRef.current = null;
    };
  }, [loadId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div>
      <div
        ref={containerRef}
        style={{ height, borderRadius: 8, overflow: "hidden", zIndex: 0 }}
      />
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
            {sharing ? "⏹ Detener ubicación" : "📍 Compartir ubicación"}
          </button>
        </div>
      )}
    </div>
  );
}
