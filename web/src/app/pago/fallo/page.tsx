"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function FalloContent() {
  const router = useRouter();
  const params = useSearchParams();
  const offerId = params.get("offerId");
  const loadId  = params.get("loadId");

  const [retrying, setRetrying] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleRetry = async () => {
    if (!offerId || !loadId) { router.push("/dador"); return; }
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/create-preference", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ offerId, loadId, titulo: "Transporte de carga" }),
      });
      const data = await res.json();
      if (res.ok && data.init_point) {
        window.location.href = data.init_point;
      } else {
        setError(data.error ?? "No se pudo reintentar. Volvé al dashboard.");
        setRetrying(false);
      }
    } catch {
      setError("Error de conexión.");
      setRetrying(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--color-background-tertiary)", padding: 24,
    }}>
      <div style={{
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "48px 40px",
        maxWidth: 440,
        width: "100%",
        textAlign: "center",
        boxShadow: "0 4px 32px rgba(0,0,0,0.06)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✕</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#b91c1c", marginBottom: 8 }}>
          El pago no se procesó
        </div>
        <div style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: 28 }}>
          El pago fue cancelado o rechazado. No se realizó ningún cobro.
          {offerId && " La carga sigue reservada — podés intentar el pago de nuevo."}
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#b91c1c" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {offerId && loadId && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              style={{ width: "100%", padding: "12px 0", borderRadius: "var(--border-radius-md)", border: "none", background: "#009ee3", color: "#fff", fontWeight: 700, fontSize: 15, cursor: retrying ? "default" : "pointer", opacity: retrying ? 0.7 : 1 }}
            >
              {retrying ? "Preparando pago..." : "Reintentar con MercadoPago"}
            </button>
          )}
          <button
            onClick={() => router.push("/dador")}
            style={{ width: "100%", padding: "12px 0", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            Volver al dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PagoFallo() {
  return (
    <Suspense>
      <FalloContent />
    </Suspense>
  );
}
