"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Payout {
  id: string;
  amount: number;
  payout_status: "requested" | "done" | "transfer_failed";
  payout_method: string;
  payout_destination: string;
  payout_transfer_id: string | null;
  created_at: string;
  pickup_city: string | null;
  dropoff_city: string | null;
  driver_name: string | null;
  driver_email: string | null;
  mp_transfer_url: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  mercadopago: "MercadoPago",
  cvu_cbu: "CVU / CBU",
  alias: "Alias",
};

export default function AdminRetirosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && session.user.role !== "admin") { router.replace("/dashboard"); return; }
    if (status === "authenticated") {
      fetch("/api/admin/payouts")
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d)) setPayouts(d); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [status, session, router]);

  async function markPaid(id: string) {
    setMarking(id);
    const res = await fetch(`/api/admin/payouts/${id}/mark-paid`, { method: "POST" });
    if (res.ok) {
      setPayouts((prev) => prev.map((p) => p.id === id ? { ...p, payout_status: "done" } : p));
    }
    setMarking(null);
  }

  const pending = payouts.filter((p) => p.payout_status === "requested");
  const done = payouts.filter((p) => p.payout_status === "done");

  if (status === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
        <div style={{ color: "#6b7280", fontSize: 14 }}>Cargando...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="fa-solid fa-money-bill-transfer" style={{ color: "#fff", fontSize: 14 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Retiros de transportistas</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Gestión de pagos pendientes</div>
          </div>
        </div>
        <button onClick={() => router.push("/admin")} style={{ fontSize: 13, padding: "7px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", cursor: "pointer" }}>
          ← Volver al panel
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#b45309" }}>{pending.length}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Pendientes</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#065f46" }}>{done.length}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Pagados</div>
          </div>
        </div>

        {pending.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14, marginBottom: 24 }}>
            No hay retiros pendientes
          </div>
        )}

        {pending.map((p) => (
          <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 14, border: "1px solid #e5e7eb", borderLeft: "4px solid #f59e0b" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#111827" }}>
                  ${p.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })} ARS
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  {p.driver_name ?? "—"} · {p.driver_email ?? "—"}
                </div>
                {p.pickup_city && (
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                    {p.pickup_city} → {p.dropoff_city}
                  </div>
                )}
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#374151", fontWeight: 500 }}>
                    {METHOD_LABEL[p.payout_method] ?? p.payout_method}
                  </span>
                  <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#374151", fontFamily: "monospace" }}>
                    {p.payout_destination}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                  Solicitado el {new Date(p.created_at).toLocaleString("es-AR")}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                {p.mp_transfer_url && (
                  <a
                    href={p.mp_transfer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: "#009ee3", color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginRight: 6 }} />
                    Transferir en MP
                  </a>
                )}
                <button
                  onClick={() => markPaid(p.id)}
                  disabled={marking === p.id}
                  style={{ background: "#3a806b", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", opacity: marking === p.id ? 0.6 : 1 }}
                >
                  {marking === p.id ? "Marcando..." : "✓ Marcar como pagado"}
                </button>
              </div>
            </div>
          </div>
        ))}

        {done.length > 0 && (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginTop: 32, marginBottom: 12 }}>Pagados</div>
            {done.map((p) => (
              <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: 18, marginBottom: 10, border: "1px solid #e5e7eb", borderLeft: "4px solid #3a806b", opacity: 0.75 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
                      ${p.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })} ARS · {p.driver_name ?? "—"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {METHOD_LABEL[p.payout_method] ?? p.payout_method} · <span style={{ fontFamily: "monospace" }}>{p.payout_destination}</span>
                    </div>
                  </div>
                  <span style={{ background: "#d1fae5", color: "#065f46", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                    ✓ Pagado
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
