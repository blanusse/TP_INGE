"use client";

import { useRouter } from "next/navigation";

export default function PagoFallo() {
  const router = useRouter();
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
          El pago fue cancelado o rechazado. No se realizó ningún cobro. La carga sigue reservada para vos — podés intentar el pago de nuevo.
        </div>
        <button
          onClick={() => router.push("/dador")}
          style={{ width: "100%", padding: "12px 0", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--color-brand)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
        >
          Volver e intentar de nuevo
        </button>
      </div>
    </div>
  );
}
