"use client";

import React from "react";
import { signOut } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface ReportData {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  description: string;
  evidence_url: string | null;
  status: "pending" | "under_review" | "resolved" | "dismissed";
  admin_action: string | null;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter: { id: string; name: string; email: string; role: string };
  reported: { id: string; name: string; email: string; role: string };
}

type AdminTab = "retiros" | "reportes";

// ─── Constants ────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  mercadopago: "MercadoPago",
  cvu_cbu: "CVU / CBU",
  alias: "Alias",
};

const REASON_LABEL: Record<string, string> = {
  fraud: "Fraude / estafa",
  non_delivery: "Incumplimiento de entrega",
  harassment: "Acoso / lenguaje inapropiado",
  fake_data: "Datos falsos",
  other: "Otro",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  under_review: "En revisión",
  resolved: "Resuelto",
  dismissed: "Descartado",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b",
  under_review: "#3b82f6",
  resolved: "#10b981",
  dismissed: "#6b7280",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const [secret, setSecret] = React.useState("");
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState("");
  const [tab, setTab] = React.useState<AdminTab>("retiros");

  function handleLogout() {
    signOut({ callbackUrl: "/login" });
  }

  function login(e: React.FormEvent) {
    e.preventDefault();
    setSecret(input.trim());
  }

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
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>Panel de Admin</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleLogout}
              style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 16px", fontSize: 13, color: "#6b7280", cursor: "pointer" }}
            >
              ← Volver a login
            </button>
            <button
              onClick={() => setSecret("")}
              style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 16px", fontSize: 13, color: "#6b7280", cursor: "pointer" }}
            >
              Salir
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #e5e7eb" }}>
          <button
            onClick={() => setTab("retiros")}
            style={{
              padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", background: "none",
              color: tab === "retiros" ? "#3a806b" : "#6b7280",
              borderBottom: tab === "retiros" ? "2px solid #3a806b" : "2px solid transparent",
              marginBottom: -2,
            }}
          >
            Retiros
          </button>
          <button
            onClick={() => setTab("reportes")}
            style={{
              padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", background: "none",
              color: tab === "reportes" ? "#3a806b" : "#6b7280",
              borderBottom: tab === "reportes" ? "2px solid #3a806b" : "2px solid transparent",
              marginBottom: -2,
            }}
          >
            Reportes
          </button>
        </div>

        {tab === "retiros" && <SeccionRetiros secret={secret} onAuthError={() => { setError("Contraseña incorrecta."); setSecret(""); }} />}
        {tab === "reportes" && <SeccionReportes secret={secret} />}
      </div>
    </div>
  );
}

// ─── Retiros Section ──────────────────────────────────────────────────────────

function SeccionRetiros({ secret, onAuthError }: { secret: string; onAuthError: () => void }) {
  const [payouts, setPayouts] = React.useState<Payout[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [marking, setMarking] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/payouts", { headers: { "x-internal-secret": secret } })
      .then((r) => {
        if (r.status === 401) { onAuthError(); return null; }
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

  if (loading) return <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Cargando...</div>;
  if (error) return <div style={{ color: "#ef4444", marginBottom: 16 }}>{error}</div>;

  return (
    <>
      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>Transferí el monto y marcalo como pagado</div>

      {pending.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 32, textAlign: "center", color: "#6b7280", marginBottom: 24 }}>
          No hay retiros pendientes
        </div>
      )}

      {pending.map((p) => (
        <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 16, boxShadow: "0 1px 4px #0001", borderLeft: "4px solid #f59e0b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "#111827" }}>
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
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#374151", fontWeight: 500 }}>
                  {METHOD_LABEL[p.payout_method] ?? p.payout_method}
                </span>
                <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#374151", fontFamily: "monospace" }}>
                  {p.payout_destination}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                {new Date(p.created_at).toLocaleString("es-AR")}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              {p.mp_transfer_url && (
                <a
                  href={p.mp_transfer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: "#009ee3", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  Transferir en MP →
                </a>
              )}
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
    </>
  );
}

// ─── Reportes Section ─────────────────────────────────────────────────────────

function SeccionReportes({ secret }: { secret: string }) {
  const [reports, setReports] = React.useState<ReportData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<string>("pending");
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/reports", { headers: { "x-internal-secret": secret } })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setReports(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [secret]);

  async function handleAction(reportId: string, body: { status?: string; admin_action?: string; admin_notes?: string }) {
    setActionLoading(reportId);
    const res = await fetch(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, ...updated } : r)));
    }
    setActionLoading(null);
  }

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  if (loading) return <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Cargando reportes...</div>;

  return (
    <>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {["pending", "under_review", "resolved", "dismissed", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: filter === f ? "none" : "1px solid #d1d5db",
              background: filter === f ? "#3a806b" : "#fff",
              color: filter === f ? "#fff" : "#374151",
            }}
          >
            {f === "all" ? "Todos" : STATUS_LABEL[f]} ({f === "all" ? reports.length : reports.filter((r) => r.status === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 32, textAlign: "center", color: "#6b7280" }}>
          No hay reportes en esta categoría
        </div>
      )}

      {filtered.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          loading={actionLoading === report.id}
          onAction={(body) => handleAction(report.id, body)}
        />
      ))}
    </>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────

function ReportCard({ report, loading, onAction }: { report: ReportData; loading: boolean; onAction: (body: Record<string, string>) => void }) {
  const [notes, setNotes] = React.useState(report.admin_notes ?? "");

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 16, boxShadow: "0 1px 4px #0001", borderLeft: `4px solid ${STATUS_COLOR[report.status] ?? "#6b7280"}` }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div>
          <span style={{ background: STATUS_COLOR[report.status] + "20", color: STATUS_COLOR[report.status], borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
            {STATUS_LABEL[report.status]}
          </span>
          <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, marginLeft: 8 }}>
            {REASON_LABEL[report.reason] ?? report.reason}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          {new Date(report.created_at).toLocaleString("es-AR")}
        </div>
      </div>

      {/* Users */}
      <div style={{ display: "flex", gap: 24, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>Reportante</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{report.reporter.name}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{report.reporter.email} · {report.reporter.role}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>Reportado</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{report.reported.name}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{report.reported.email} · {report.reported.role}</div>
        </div>
      </div>

      {/* Description */}
      <div style={{ background: "#f9fafb", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{report.description}</div>
      </div>

      {/* Evidence */}
      {report.evidence_url && (
        <div style={{ marginBottom: 12 }}>
          <a href={report.evidence_url} target="_blank" rel="noopener noreferrer">
            <img
              src={report.evidence_url}
              alt="Evidencia"
              style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb", cursor: "pointer" }}
            />
          </a>
        </div>
      )}

      {/* Admin actions */}
      {(report.status === "pending" || report.status === "under_review") && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, marginTop: 12 }}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas del admin (opcional)..."
            rows={2}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, resize: "none", marginBottom: 10, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {report.status === "pending" && (
              <button
                disabled={loading}
                onClick={() => onAction({ status: "under_review", admin_notes: notes })}
                style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#3b82f6", color: "#fff", border: "none", opacity: loading ? 0.6 : 1 }}
              >
                En revisión
              </button>
            )}
            <button
              disabled={loading}
              onClick={() => onAction({ status: "resolved", admin_action: "none", admin_notes: notes })}
              style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#10b981", color: "#fff", border: "none", opacity: loading ? 0.6 : 1 }}
            >
              Resolver
            </button>
            <button
              disabled={loading}
              onClick={() => onAction({ status: "dismissed", admin_action: "none", admin_notes: notes })}
              style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#6b7280", color: "#fff", border: "none", opacity: loading ? 0.6 : 1 }}
            >
              Descartar
            </button>
            <button
              disabled={loading}
              onClick={() => onAction({ status: "resolved", admin_action: "suspended", admin_notes: notes })}
              style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#f59e0b", color: "#fff", border: "none", opacity: loading ? 0.6 : 1 }}
            >
              Suspender
            </button>
            <button
              disabled={loading}
              onClick={() => onAction({ status: "resolved", admin_action: "banned", admin_notes: notes })}
              style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#ef4444", color: "#fff", border: "none", opacity: loading ? 0.6 : 1 }}
            >
              Banear
            </button>
          </div>
        </div>
      )}

      {/* Admin action taken */}
      {report.admin_action && report.admin_action !== "none" && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          Acción tomada: <strong style={{ color: report.admin_action === "banned" ? "#ef4444" : "#f59e0b" }}>{report.admin_action}</strong>
          {report.admin_notes && <span> — {report.admin_notes}</span>}
        </div>
      )}
    </div>
  );
}
