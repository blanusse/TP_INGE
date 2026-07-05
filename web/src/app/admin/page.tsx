"use client";

import React from "react";
import { signOut } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  account_status: "active" | "suspended" | "banned";
  created_at: string;
  is_verified: boolean;
}

interface AuditEntry {
  id: string;
  admin_email: string;
  target_user_email: string;
  action: string;
  reason: string | null;
  created_at: string;
}

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

type AdminTab = "usuarios" | "retiros" | "reportes" | "audit" | "seguros" | "sospechosas" | "simulacion";

interface SuspiciousLoad {
  id: string;
  pickup_city: string;
  dropoff_city: string;
  cargo_type: string | null;
  price_base: number;
  suspicious_reason: string;
  created_at: string;
}

interface InsuranceProduct {
  id: string;
  name: string;
  insurer: string;
  coverage_type: string;
  price: number;
  conditions: string;
  is_active: boolean;
  created_at: string;
}

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
  const [tab, setTab] = React.useState<AdminTab>("usuarios");

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: "32px 24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>Panel de Admin</div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 16px", fontSize: 13, color: "#6b7280", cursor: "pointer" }}
          >
            Cerrar sesión
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #e5e7eb" }}>
          {([
            { key: "usuarios",    label: "Usuarios" },
            { key: "retiros",     label: "Retiros" },
            { key: "reportes",    label: "Reportes" },
            { key: "audit",       label: "Audit log" },
            { key: "seguros",     label: "Seguros" },
            { key: "sospechosas", label: "Cargas sospechosas" },
            { key: "simulacion",  label: "Simulación" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", background: "none",
                color: tab === t.key ? "#3a806b" : "#6b7280",
                borderBottom: tab === t.key ? "2px solid #3a806b" : "2px solid transparent",
                marginBottom: -2,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "usuarios"    && <SeccionUsuarios />}
        {tab === "retiros"     && <SeccionRetiros />}
        {tab === "reportes"    && <SeccionReportes />}
        {tab === "audit"       && <SeccionAuditLog />}
        {tab === "seguros"     && <SeccionSegurosAdmin />}
        {tab === "sospechosas" && <SeccionCargasSospechosas />}
        {tab === "simulacion"  && <SeccionSimulacion />}
      </div>
    </div>
  );
}

// ─── Retiros Section ──────────────────────────────────────────────────────────

function SeccionRetiros() {
  const [payouts, setPayouts] = React.useState<Payout[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [marking, setMarking] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/payouts")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setPayouts(d); })
      .catch(() => setError("Error al cargar los retiros."))
      .finally(() => setLoading(false));
  }, []);

  async function markPaid(id: string) {
    setMarking(id);
    const res = await fetch(`/api/admin/payouts/${id}/mark-paid`, { method: "POST" });
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

function SeccionReportes() {
  const [reports, setReports] = React.useState<ReportData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<string>("pending");
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/reports")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setReports(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAction(reportId: string, body: { status?: string; admin_action?: string; admin_notes?: string }) {
    setActionLoading(reportId);
    const res = await fetch(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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

// ─── Usuarios Section ─────────────────────────────────────────────────────────

const STATUS_USER_COLOR: Record<string, string> = {
  active:    "#10b981",
  suspended: "#f59e0b",
  banned:    "#ef4444",
};

const STATUS_USER_LABEL: Record<string, string> = {
  active:    "Activa",
  suspended: "Suspendida",
  banned:    "Baneada",
};

const ROLE_LABEL: Record<string, string> = {
  transportista: "Transportista",
  dador:         "Dador de carga",
  admin:         "Admin",
};

function SeccionUsuarios() {
  const [users, setUsers]     = React.useState<UserRow[]>([]);
  const [total, setTotal]     = React.useState(0);
  const [page, setPage]       = React.useState(1);
  const [search, setSearch]   = React.useState("");
  const [query, setQuery]     = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [actionUser, setActionUser] = React.useState<UserRow | null>(null);
  const [actionType, setActionType] = React.useState<"suspend" | "unsuspend" | "ban" | "unban" | null>(null);
  const [reason, setReason]   = React.useState("");
  const [saving, setSaving]   = React.useState(false);
  const [toast, setToast]     = React.useState("");

  const limit = 20;

  React.useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (query) qs.set("search", query);
    fetch(`/api/admin/users?${qs}`)
      .then((r) => r.json())
      .then((d) => { setUsers(d.users ?? []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, query]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  function openAction(user: UserRow, type: "suspend" | "unsuspend" | "ban" | "unban") {
    setActionUser(user);
    setActionType(type);
    setReason("");
  }

  async function confirmAction() {
    if (!actionUser || !actionType) return;
    setSaving(true);
    const res = await fetch(`/api/admin/users/${actionUser.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionType, reason: reason || undefined }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => u.id === updated.id ? { ...u, account_status: updated.account_status } : u));
      setToast(`Usuario ${actionType === "suspend" ? "suspendido" : actionType === "unsuspend" ? "reactivado" : actionType === "ban" ? "baneado" : "desbaneado"} correctamente.`);
      setTimeout(() => setToast(""), 3000);
    }
    setSaving(false);
    setActionUser(null);
    setActionType(null);
  }

  const pages = Math.ceil(total / limit);

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#1f2937", color: "#fff", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 500, zIndex: 100, boxShadow: "0 4px 20px #0003" }}>
          {toast}
        </div>
      )}

      {/* Modal */}
      {actionUser && actionType && (
        <div style={{ position: "fixed", inset: 0, background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 420, maxWidth: "90vw", boxShadow: "0 8px 40px #0003" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
              {actionType === "suspend" ? "Suspender cuenta" : actionType === "unsuspend" ? "Reactivar cuenta" : actionType === "ban" ? "Banear cuenta" : "Desbanear cuenta"}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 18 }}>
              {actionUser.name} · {actionUser.email}
            </div>
            {(actionType === "suspend" || actionType === "ban") && (
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo (opcional)..."
                rows={3}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, resize: "none", marginBottom: 16, boxSizing: "border-box" }}
              />
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setActionUser(null); setActionType(null); }} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
              <button
                disabled={saving}
                onClick={confirmAction}
                style={{
                  padding: "8px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#fff",
                  background: actionType === "ban" ? "#ef4444" : actionType === "suspend" ? "#f59e0b" : "#10b981",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email..."
          style={{ flex: 1, padding: "9px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
        />
        <button type="submit" style={{ padding: "9px 20px", borderRadius: 8, background: "#3a806b", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Buscar
        </button>
      </form>

      {loading ? (
        <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Cargando usuarios...</div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>{total} usuario{total !== 1 ? "s" : ""}</div>
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px #0001", overflow: "hidden" }}>
            {users.map((u, i) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{u.email} · {ROLE_LABEL[u.role] ?? u.role}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{new Date(u.created_at).toLocaleDateString("es-AR")}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: (STATUS_USER_COLOR[u.account_status] ?? "#6b7280") + "20", color: STATUS_USER_COLOR[u.account_status] ?? "#6b7280", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                    {STATUS_USER_LABEL[u.account_status] ?? u.account_status}
                  </span>
                  {!u.is_verified && (
                    <span style={{ background: "#f3f4f6", color: "#6b7280", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>Sin verificar</span>
                  )}
                </div>
                {u.role !== "admin" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {u.account_status === "active" && (
                      <>
                        <button onClick={() => openAction(u, "suspend")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          Suspender
                        </button>
                        <button onClick={() => openAction(u, "ban")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#991b1b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          Banear
                        </button>
                      </>
                    )}
                    {u.account_status === "suspended" && (
                      <>
                        <button onClick={() => openAction(u, "unsuspend")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#d1fae5", color: "#065f46", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          Reactivar
                        </button>
                        <button onClick={() => openAction(u, "ban")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#991b1b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          Banear
                        </button>
                      </>
                    )}
                    {u.account_status === "banned" && (
                      <button onClick={() => openAction(u, "unban")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#d1fae5", color: "#065f46", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Desbanear
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {pages > 1 && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}>
                ← Anterior
              </button>
              <span style={{ padding: "7px 16px", fontSize: 13, color: "#6b7280" }}>Página {page} de {pages}</span>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: page >= pages ? "not-allowed" : "pointer", opacity: page >= pages ? 0.5 : 1 }}>
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ─── Audit Log Section ────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  suspend:   "Suspendió",
  unsuspend: "Reactivó",
  ban:       "Baneó",
  unban:     "Desbaneó",
};

const ACTION_COLOR: Record<string, string> = {
  suspend:   "#f59e0b",
  unsuspend: "#10b981",
  ban:       "#ef4444",
  unban:     "#10b981",
};

function SeccionAuditLog() {
  const [logs, setLogs]       = React.useState<AuditEntry[]>([]);
  const [total, setTotal]     = React.useState(0);
  const [page, setPage]       = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const limit = 20;

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/audit-log?page=${page}&limit=${limit}`)
      .then((r) => r.json())
      .then((d) => { setLogs(d.logs ?? []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const pages = Math.ceil(total / limit);

  if (loading) return <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Cargando audit log...</div>;

  return (
    <>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>{total} acción{total !== 1 ? "es" : ""} registrada{total !== 1 ? "s" : ""}</div>

      {logs.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 32, textAlign: "center", color: "#6b7280" }}>
          No hay acciones registradas aún
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px #0001", overflow: "hidden" }}>
          {logs.map((log, i) => (
            <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6", flexWrap: "wrap" }}>
              <span style={{ background: (ACTION_COLOR[log.action] ?? "#6b7280") + "20", color: ACTION_COLOR[log.action] ?? "#6b7280", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                {ACTION_LABEL[log.action] ?? log.action}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#111827" }}>
                  <strong>{log.admin_email}</strong> → <strong>{log.target_user_email}</strong>
                </div>
                {log.reason && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Motivo: {log.reason}</div>}
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>
                {new Date(log.created_at).toLocaleString("es-AR")}
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}>
            ← Anterior
          </button>
          <span style={{ padding: "7px 16px", fontSize: 13, color: "#6b7280" }}>Página {page} de {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: page >= pages ? "not-allowed" : "pointer", opacity: page >= pages ? 0.5 : 1 }}>
            Siguiente →
          </button>
        </div>
      )}
    </>
  );
}

// ─── Seguros Section ──────────────────────────────────────────────────────────

const COVERAGE_TYPES = [
  "Todo riesgo",
  "Robo y hurto",
  "Daño parcial",
  "Responsabilidad civil",
  "Carga refrigerada",
  "Mercadería peligrosa",
  "Otro",
];

const EMPTY_FORM = { name: "", insurer: "", coverage_type: "Todo riesgo", price: "", conditions: "" };

function SeccionSegurosAdmin() {
  const [products, setProducts] = React.useState<InsuranceProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<InsuranceProduct | null>(null);
  const [editForm, setEditForm] = React.useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = React.useState(false);
  const [editErrors, setEditErrors] = React.useState<Record<string, string>>({});

  const cargar = () => {
    setLoading(true);
    fetch("/api/insurance/products/all")
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { cargar(); }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "El nombre es obligatorio.";
    if (!form.insurer.trim()) e.insurer = "La aseguradora es obligatoria.";
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) e.price = "El precio debe ser mayor a 0.";
    if (!form.conditions.trim()) e.conditions = "Las condiciones son obligatorias.";
    return e;
  };

  const guardar = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/insurance/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price: Number(form.price) }),
      });
      if (!res.ok) throw new Error();
      setForm(EMPTY_FORM);
      setFeedback("Seguro creado correctamente.");
      cargar();
    } catch {
      setFeedback("Error al guardar. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const desactivar = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/insurance/products/${id}`, { method: "DELETE" });
      cargar();
    } finally {
      setDeleting(null);
    }
  };

  const abrirEdicion = (p: InsuranceProduct) => {
    setEditing(p);
    setEditForm({ name: p.name, insurer: p.insurer, coverage_type: p.coverage_type, price: String(p.price), conditions: p.conditions });
    setEditErrors({});
  };

  const guardarEdicion = async () => {
    const errs: Record<string, string> = {};
    if (!editForm.name.trim()) errs.name = "El nombre es obligatorio.";
    if (!editForm.insurer.trim()) errs.insurer = "La aseguradora es obligatoria.";
    if (!editForm.price || isNaN(Number(editForm.price)) || Number(editForm.price) <= 0) errs.price = "El precio debe ser mayor a 0.";
    if (!editForm.conditions.trim()) errs.conditions = "Las condiciones son obligatorias.";
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/insurance/products/${editing!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, price: Number(editForm.price) }),
      });
      if (!res.ok) throw new Error();
      setEditing(null);
      setFeedback("Seguro actualizado correctamente.");
      cargar();
    } catch {
      setFeedback("Error al actualizar. Intenta de nuevo.");
    } finally {
      setEditSaving(false);
    }
  };

  const reactivar = async (id: string) => {
    try {
      await fetch(`/api/insurance/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      cargar();
    } catch {}
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 11px", borderRadius: 8,
    border: "1px solid #d1d5db", fontSize: 14, color: "#111827",
    background: "#fff", boxSizing: "border-box",
  };
  const errStyle: React.CSSProperties = { fontSize: 12, color: "#ef4444", marginTop: 3 };

  return (
    <>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 18 }}>Nuevo seguro</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Nombre del seguro *</label>
            <input style={{ ...inputStyle, borderColor: errors.name ? "#ef4444" : "#d1d5db" }} placeholder="Ej: Seguro básico de carga" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {errors.name && <div style={errStyle}>{errors.name}</div>}
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Aseguradora *</label>
            <input style={{ ...inputStyle, borderColor: errors.insurer ? "#ef4444" : "#d1d5db" }} placeholder="Ej: Sura, Zurich, MAPFRE" value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} />
            {errors.insurer && <div style={errStyle}>{errors.insurer}</div>}
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Tipo de cobertura *</label>
            <select style={inputStyle} value={form.coverage_type} onChange={(e) => setForm({ ...form, coverage_type: e.target.value })}>
              {COVERAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Precio (ARS) *</label>
            <input type="number" min={1} style={{ ...inputStyle, borderColor: errors.price ? "#ef4444" : "#d1d5db" }} placeholder="Ej: 15000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            {errors.price && <div style={errStyle}>{errors.price}</div>}
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Condiciones *</label>
            <textarea rows={4} style={{ ...inputStyle, resize: "vertical" as React.CSSProperties["resize"], borderColor: errors.conditions ? "#ef4444" : "#d1d5db" }} placeholder="Detallá qué cubre y qué no cubre el seguro, exclusiones, etc." value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} />
            {errors.conditions && <div style={errStyle}>{errors.conditions}</div>}
          </div>
        </div>
        {feedback && <div style={{ marginTop: 12, fontSize: 13, color: feedback.startsWith("Error") ? "#ef4444" : "#16a34a" }}>{feedback}</div>}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={guardar} disabled={saving} style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: "#3a806b", color: "#fff", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : "Guardar seguro"}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 12 }}>Seguros en el catálogo ({products.length})</div>

      {loading && <div style={{ textAlign: "center", padding: 32, color: "#9ca3af", fontSize: 14 }}>Cargando...</div>}

      {!loading && products.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 14, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
          No hay seguros cargados todavía.
        </div>
      )}

      {!loading && products.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {products.map((p) => (
            <div key={p.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 20px", opacity: p.is_active ? 1 : 0.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{p.name}</span>
                    {!p.is_active && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: "#6b7280" }}>Desactivado</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{p.insurer} · {p.coverage_type} · <strong style={{ color: "#111827" }}>${Number(p.price).toLocaleString("es-AR")}</strong></div>
                  <div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{p.conditions}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => abrirEdicion(p)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer" }}>
                    Editar
                  </button>
                  {p.is_active ? (
                    <button onClick={() => desactivar(p.id)} disabled={deleting === p.id} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff5f5", color: "#ef4444", fontSize: 13, cursor: "pointer" }}>
                      {deleting === p.id ? "..." : "Desactivar"}
                    </button>
                  ) : (
                    <button onClick={() => reactivar(p.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #86efac", background: "#f0fdf4", color: "#16a34a", fontSize: 13, cursor: "pointer" }}>
                      Reactivar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setEditing(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 20 }}>Editar seguro</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Nombre del seguro *</label>
                <input style={{ ...inputStyle, borderColor: editErrors.name ? "#ef4444" : "#d1d5db" }} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                {editErrors.name && <div style={errStyle}>{editErrors.name}</div>}
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Aseguradora *</label>
                <input style={{ ...inputStyle, borderColor: editErrors.insurer ? "#ef4444" : "#d1d5db" }} value={editForm.insurer} onChange={(e) => setEditForm({ ...editForm, insurer: e.target.value })} />
                {editErrors.insurer && <div style={errStyle}>{editErrors.insurer}</div>}
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Tipo de cobertura *</label>
                <select style={inputStyle} value={editForm.coverage_type} onChange={(e) => setEditForm({ ...editForm, coverage_type: e.target.value })}>
                  {COVERAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Precio (ARS) *</label>
                <input type="number" min={1} style={{ ...inputStyle, borderColor: editErrors.price ? "#ef4444" : "#d1d5db" }} value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                {editErrors.price && <div style={errStyle}>{editErrors.price}</div>}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Condiciones *</label>
                <textarea rows={4} style={{ ...inputStyle, resize: "vertical" as React.CSSProperties["resize"], borderColor: editErrors.conditions ? "#ef4444" : "#d1d5db" }} value={editForm.conditions} onChange={(e) => setEditForm({ ...editForm, conditions: e.target.value })} />
                {editErrors.conditions && <div style={errStyle}>{editErrors.conditions}</div>}
              </div>
            </div>
            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setEditing(null)} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 14, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={guardarEdicion} disabled={editSaving} style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: "#3a806b", color: "#fff", fontSize: 14, fontWeight: 600, cursor: editSaving ? "not-allowed" : "pointer", opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Cargas Sospechosas Section ───────────────────────────────────────────────

function SeccionCargasSospechosas() {
  const [loads, setLoads] = React.useState<SuspiciousLoad[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [acting, setActing] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/loads/suspicious")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.loads)) setLoads(d.loads); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleApprove(id: string) {
    setActing(id);
    const res = await fetch(`/api/admin/loads/${id}/approve`, { method: "PATCH" });
    if (res.ok) setLoads((prev) => prev.filter((l) => l.id !== id));
    setActing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta carga? Esta acción no se puede deshacer.")) return;
    setActing(id);
    const res = await fetch(`/api/admin/loads/${id}`, { method: "DELETE" });
    if (res.ok) setLoads((prev) => prev.filter((l) => l.id !== id));
    setActing(null);
  }

  if (loading) return <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Cargando...</div>;

  if (loads.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 12, padding: 40, textAlign: "center", color: "#6b7280" }}>
        No hay cargas sospechosas pendientes de revisión
      </div>
    );
  }

  return (
    <>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
        {loads.length} carga{loads.length !== 1 ? "s" : ""} con precio inusual pendiente{loads.length !== 1 ? "s" : ""} de revisión
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loads.map((load) => (
          <div
            key={load.id}
            style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px #0001", borderLeft: "4px solid #f59e0b" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#111827", marginBottom: 4 }}>
                  {load.pickup_city} → {load.dropoff_city}
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
                  {load.cargo_type ?? "Tipo no especificado"} · ${Number(load.price_base).toLocaleString("es-AR")}
                </div>
                <div style={{ fontSize: 12, color: "#b45309", background: "#fef3c7", borderRadius: 6, padding: "4px 10px", display: "inline-block" }}>
                  {load.suspicious_reason}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => handleApprove(load.id)}
                  disabled={acting === load.id}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #10b981", background: "#fff", color: "#10b981", fontSize: 13, fontWeight: 600, cursor: acting === load.id ? "not-allowed" : "pointer", opacity: acting === load.id ? 0.6 : 1 }}
                >
                  Aprobar
                </button>
                <button
                  onClick={() => handleDelete(load.id)}
                  disabled={acting === load.id}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: acting === load.id ? "not-allowed" : "pointer", opacity: acting === load.id ? 0.6 : 1 }}
                >
                  Eliminar
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
              Publicada: {new Date(load.created_at).toLocaleString("es-AR")}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Simulación de viaje Section ──────────────────────────────────────────────

const DEMO_LOAD_ID = "dd89af02-cbe8-4cc9-ba98-5b3e614553e1";

function SeccionSimulacion() {
  const [starting, setStarting] = React.useState(false);
  // Refleja si el backend tiene una simulación en curso. Mientras esté corriendo,
  // el botón queda deshabilitado para que no se disparen dos loops que se pisan.
  const [running, setRunning] = React.useState(false);

  // Consulta el estado al montar y hace polling para reactivar el botón al terminar.
  React.useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      try {
        const res = await fetch(`/api/location/${DEMO_LOAD_ID}/simulation-status`);
        if (!res.ok) return;
        const d = await res.json();
        if (!cancelled) setRunning(Boolean(d.running));
      } catch {
        // sin conexión: dejamos el estado como está
      }
    }

    checkStatus();
    const id = setInterval(checkStatus, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  async function iniciarSimulacion() {
    setStarting(true);
    // Dispara la simulación Buenos Aires → Rosario sobre la carga demo y
    // ESPERA a que el backend la acepte antes de navegar. Si navegáramos
    // sin await, la navegación cancelaría el fetch y no se dispararía.
    try {
      const res = await fetch(`/api/location/${DEMO_LOAD_ID}/simulate`, {
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
      // 409 = ya hay una simulación en curso; no arrancamos otra, solo miramos el mapa.
      if (res.status === 409) setRunning(true);
    } catch {
      // ignoramos el error: igual llevamos al mapa
    }
    window.location.href = "/dev/mapa";
  }

  const disabled = starting || running;

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 40, boxShadow: "0 1px 4px #0001", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <button
        onClick={iniciarSimulacion}
        disabled={disabled}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 8, background: "#3a806b", color: "#fff", border: "none", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.7 : 1 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
        {running ? "Simulación en curso..." : starting ? "Iniciando..." : "Simular viaje Buenos Aires → Rosario"}
      </button>
      <span style={{ fontSize: 11, color: "#9ca3af" }}>
        {running
          ? "Hay una simulación corriendo. Esperá a que termine para iniciar otra."
          : "Inicia la simulación y te lleva al mapa para ver el camión moverse."}
      </span>
      {running && (
        <button
          onClick={() => { window.location.href = "/dev/mapa"; }}
          style={{ fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8, background: "none", color: "#3a806b", border: "1px solid #3a806b", cursor: "pointer" }}
        >
          Ver el mapa →
        </button>
      )}
    </div>
  );
}
