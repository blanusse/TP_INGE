"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function ExitoContent() {
  const params   = useSearchParams();
  const router   = useRouter();
  const [status, setStatus] = useState<"confirming" | "done" | "error">("confirming");

  useEffect(() => {
    const offerId          = params.get("external_reference");
    const loadId           = params.get("loadId");
    const collectionStatus = params.get("collection_status");

    if (!offerId || !loadId || collectionStatus !== "approved") {
      setStatus("error");
      return;
    }

    fetch(`/api/payments/confirm?offerId=${offerId}&loadId=${loadId}`, { method: "POST" })
      .then((r) => { if (r.ok) setStatus("done"); else setStatus("error"); })
      .catch(() => setStatus("error"));
  }, [params]);

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
        {status === "confirming" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 8 }}>
              Confirmando pago...
            </div>
            <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
              No cerrés esta ventana.
            </div>
          </>
        )}

        {status === "done" && (
          <>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 36 }}>✓</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#15803d", marginBottom: 8 }}>
              ¡Pago confirmado!
            </div>
            <div style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: 28 }}>
              El dinero quedó reservado en CargaBack. El camionero puede iniciar el viaje con la garantía de cobro.
            </div>
            <div style={{ background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: "var(--border-radius-md)", padding: "12px 16px", marginBottom: 28, fontSize: 13, color: "#15803d" }}>
              Podés chatear con el camionero desde la sección <strong>Mensajes</strong> para coordinar la entrega.
            </div>
            <button
              onClick={() => router.push("/dador")}
              style={{ width: "100%", padding: "12px 0", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
            >
              Ir a mis cargas →
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 8 }}>
              No pudimos confirmar el pago
            </div>
            <div style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 28 }}>
              Si el pago fue debitado, contactanos. Si no fue procesado, podés intentar de nuevo.
            </div>
            <button
              onClick={() => router.push("/dador")}
              style={{ width: "100%", padding: "12px 0", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
            >
              Volver al dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PagoExito() {
  return (
    <Suspense>
      <ExitoContent />
    </Suspense>
  );
}
