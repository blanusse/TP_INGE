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

type AdminTab = "usuarios" | "retiros" | "reportes" | "audit";

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
            { key: "usuarios", label: "Usuarios" },
            { key: "retiros",  label: "Retiros" },
            { key: "reportes", label: "Reportes" },
            { key: "audit",    label: "Audit log" },
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

        {tab === "usuarios" && <SeccionUsuarios />}
        {tab === "retiros"  && <SeccionRetiros />}
        {tab === "reportes" && <SeccionReportes />}
        {tab === "audit"    && <SeccionAuditLog />}
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
