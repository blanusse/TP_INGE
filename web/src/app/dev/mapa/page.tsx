"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const TripMap = dynamic(() => import("@/app/_components/TripMap"), { ssr: false });

const LOAD_ID = "dd89af02-cbe8-4cc9-ba98-5b3e614553e1";

export default function DevMapaPage() {
  const [estado, setEstado] = useState<"idle" | "cargando" | "ok" | "error">(
    "idle",
  );
  const [mensaje, setMensaje] = useState("");

  async function iniciarSimulacion() {
    setEstado("cargando");
    setMensaje("");
    try {
      const res = await fetch(`/api/location/${LOAD_ID}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originLat: -34.6037,
          originLng: -58.3816,
          destLat: -32.9468,
          destLng: -60.6393,
          delayMs: 800,
          useOsrm: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEstado("error");
        setMensaje(
          res.status === 401
            ? "Tenés que estar logueada para iniciar la simulación."
            : `No se pudo iniciar (${res.status}). ${data?.error ?? data?.message ?? ""}`,
        );
        return;
      }
      setEstado("ok");
      setMensaje("Simulación iniciada. El camión va a empezar a moverse.");
    } catch {
      setEstado("error");
      setMensaje("Error de red al iniciar la simulación.");
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: "0 auto", fontFamily: "sans-serif" }}>
      <h2 style={{ marginBottom: 4 }}>Simulación: prueba mapas</h2>
      <p style={{ color: "#6b7280", marginBottom: 20, fontSize: 14 }}>
        Buenos Aires → Rosario &nbsp;·&nbsp; Ruta Nacional 9 &nbsp;·&nbsp;{" "}
        <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>
          loadId: {LOAD_ID}
        </code>
      </p>

      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button
          onClick={iniciarSimulacion}
          disabled={estado === "cargando"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            padding: "11px 22px",
            borderRadius: 8,
            background: estado === "cargando" ? "#9ca3af" : "#3a806b",
            color: "#fff",
            border: "none",
            cursor: estado === "cargando" ? "default" : "pointer",
          }}
        >
          ▶ {estado === "cargando" ? "Iniciando..." : "Iniciar simulación"}
        </button>
        {mensaje && (
          <span
            style={{
              fontSize: 13,
              color: estado === "error" ? "#dc2626" : "#16a34a",
              fontWeight: 500,
            }}
          >
            {mensaje}
          </span>
        )}
      </div>

      <TripMap
        loadId={LOAD_ID}
        originLat={-34.6037}
        originLng={-58.3816}
        destLat={-32.9468}
        destLng={-60.6393}
        height={520}
        isDriver={false}
      />
    </div>
  );
}
