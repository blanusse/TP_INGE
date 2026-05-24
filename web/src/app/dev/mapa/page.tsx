"use client";

import dynamic from "next/dynamic";

const TripMap = dynamic(() => import("@/app/_components/TripMap"), { ssr: false });

const LOAD_ID = "prueba-mapas";

export default function DevMapaPage() {
  return (
    <div style={{ padding: 32, maxWidth: 860, margin: "0 auto", fontFamily: "sans-serif" }}>
      <h2 style={{ marginBottom: 4 }}>Simulación: prueba mapas</h2>
      <p style={{ color: "#6b7280", marginBottom: 24, fontSize: 14 }}>
        Buenos Aires → Rosario &nbsp;·&nbsp; Ruta Nacional 9 &nbsp;·&nbsp;{" "}
        <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>
          loadId: {LOAD_ID}
        </code>
      </p>

      <TripMap
        loadId={LOAD_ID}
        originLat={-34.6037}
        originLng={-58.3816}
        destLat={-32.9468}
        destLng={-60.6393}
        height={520}
        isDriver={false}
      />

      <div style={{ marginTop: 24, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, fontSize: 13, color: "#374151" }}>
        <strong>Cómo lanzar la simulación:</strong>
        <pre style={{ marginTop: 8, background: "#1f2937", color: "#f9fafb", padding: 12, borderRadius: 6, overflowX: "auto" }}>
          {`cd api\nnpx ts-node scripts/simulate-trip.ts`}
        </pre>
      </div>
    </div>
  );
}
