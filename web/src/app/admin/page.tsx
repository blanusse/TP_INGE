"use client";

import React from "react";
import { signOut } from "next-auth/react";


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

export default function AdminPayoutsPage() {
  const [secret, setSecret] = React.useState("");
  const [input, setInput] = React.useState("");
  const [payouts, setPayouts] = React.useState<Payout[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [marking, setMarking] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  function login(e: React.FormEvent) {
    e.preventDefault();
    setSecret(input.trim());
  }

  React.useEffect(() => {
    if (!secret) return;
    setLoading(true);
    setError("");
    fetch("/api/admin/payouts", { headers: { "x-internal-secret": secret } })
      .then((r) => {
        if (r.status === 401) { setError("Contraseña incorrecta."); setSecret(""); return null; }
        return r.json();
      })
      .then((d) => { if (d) setPayouts(d); })
      .catch(() => setError("Error al cargar los retiros."))
      .finally(() => setLoading(false));
  }, [secret]);

  async function markPaid(id: string) {
    setMarking(id);
    const res = await fetch(`/api/admin/payouts/${id}/mark-paid`, {
      method: "POST",
      headers: { "x-internal-secret": secret },
    });
    if (res.ok) {
      setPayouts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, payout_status: "done" } : p))
      );
    }
    setMarking(null);
  }

  const pending = payouts.filter((p) => p.payout_status === "requested");
  const done = payouts.filter((p) => p.payout_status === "done");

  if (!secret) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6" }}>
        <form onSubmit={login} style={{ background: "#fff", padding: 40, borderRadius: 12, boxShadow: "0 2px 16px #0001", minWidth: 320 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#3a806b", marginBottom: 8 }}>Panel de Admin</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>Ingresá la contraseña de administrador</div>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Contraseña"
            autoFocus
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, marginBottom: 16, boxSizing: "border-box" }}
          />
          {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button
            type="submit"
            style={{ width: "100%", background: "#3a806b", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: "32px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>Retiros pendientes</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>Transferí el monto y marcalo como pagado</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 16px", fontSize: 13, color: "#6b7280", cursor: "pointer" }}
          >
            Cerrar sesión
          </button>
        </div>

        {loading && <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Cargando...</div>}
        {error && <div style={{ color: "#ef4444", marginBottom: 16 }}>{error}</div>}

        {!loading && pending.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 32, textAlign: "center", color: "#6b7280", marginBottom: 24 }}>
            No hay retiros pendientes
          </div>
        )}

        {pending.map((p) => (
          <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 16, boxShadow: "0 1px 4px #0001", borderLeft: "4px solid #f59e0b" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {p.driver_name ?? "—"} · {p.driver_email ?? "—"}
                </div>
                {p.pickup_city && (
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                    {p.pickup_city} → {p.dropoff_city}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  {new Date(p.created_at).toLocaleString("es-AR")}
                </div>
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#6b7280", width: 60 }}>Monto</span>
                    <span style={{ fontWeight: 700, fontSize: 18, color: "#111827" }}>
                      ${p.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })} ARS
                    </span>
                    <button onClick={() => copyText(String(p.amount), `amount-${p.id}`)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: copied === `amount-${p.id}` ? "#d1fae5" : "#fff", color: copied === `amount-${p.id}` ? "#065f46" : "#6b7280", cursor: "pointer" }}>
                      {copied === `amount-${p.id}` ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#6b7280", width: 60 }}>{METHOD_LABEL[p.payout_method] ?? p.payout_method}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 14, color: "#111827", background: "#f3f4f6", borderRadius: 6, padding: "3px 10px" }}>
                      {p.payout_destination}
                    </span>
                    <button onClick={() => copyText(p.payout_destination, `dest-${p.id}`)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: copied === `dest-${p.id}` ? "#d1fae5" : "#fff", color: copied === `dest-${p.id}` ? "#065f46" : "#6b7280", cursor: "pointer" }}>
                      {copied === `dest-${p.id}` ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <a
                  href="https://www.mercadopago.com.ar/send-money"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: "#009ee3", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  Transferir en MP →
                </a>
                <button
                  onClick={() => markPaid(p.id)}
                  disabled={marking === p.id}
                  style={{ background: "#3a806b", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", opacity: marking === p.id ? 0.6 : 1 }}
                >
                  {marking === p.id ? "Marcando..." : "✓ Marcar como pagado"}
                </button>
              </div>
            </div>
          </div>
        ))}

        {done.length > 0 && (
          <>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginTop: 32, marginBottom: 12 }}>Pagados</div>
            {done.map((p) => (
              <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 10, boxShadow: "0 1px 4px #0001", borderLeft: "4px solid #3a806b", opacity: 0.8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>
                      ${p.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })} ARS · {p.driver_name ?? "—"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {METHOD_LABEL[p.payout_method] ?? p.payout_method} · {p.payout_destination}
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
