"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type DocumentStatus = "pending" | "approved" | "rejected";

interface TruckerDoc {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_email: string;
  tipo: "dni" | "vtv" | "seguro" | "carnet";
  url: string;
  status: DocumentStatus;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  dni: "DNI",
  vtv: "VTV",
  seguro: "Seguro",
  carnet: "Carnet de conducir",
};

const STATUS_LABEL: Record<DocumentStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: "En revisión", color: "#b45309", bg: "#fef3c7" },
  approved: { label: "Aprobado",    color: "#065f46", bg: "#d1fae5" },
  rejected: { label: "Rechazado",   color: "#991b1b", bg: "#fee2e2" },
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [docs, setDocs] = useState<TruckerDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DocumentStatus | "all">("pending");
  const [noteModal, setNoteModal] = useState<{ doc: TruckerDoc; action: "approved" | "rejected" } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && session.user.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/documents")
        .then((r) => r.json())
        .then((d) => setDocs(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [status, session, router]);

  const handleAction = async (doc: TruckerDoc, action: "approved" | "rejected") => {
    setNoteModal({ doc, action });
    setNoteText("");
  };

  const submitAction = async () => {
    if (!noteModal) return;
    setSubmitting(true);
    const res = await fetch(`/api/documents/${noteModal.doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: noteModal.action, admin_note: noteText || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDocs((prev) => prev.map((d) => d.id === updated.id ? { ...d, ...updated } : d));
    }
    setSubmitting(false);
    setNoteModal(null);
  };

  const filtered = filter === "all" ? docs : docs.filter((d) => d.status === filter);

  const counts = {
    pending:  docs.filter((d) => d.status === "pending").length,
    approved: docs.filter((d) => d.status === "approved").length,
    rejected: docs.filter((d) => d.status === "rejected").length,
  };

  if (status === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
        <div style={{ color: "#6b7280", fontSize: 14 }}>Cargando panel admin...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="fa-solid fa-shield-halved" style={{ color: "#fff", fontSize: 14 }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Panel de Administración</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Verificación de documentos</div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <div key={s} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px", cursor: "pointer", outline: filter === s ? "2px solid #2563eb" : "none" }} onClick={() => setFilter(s)}>
              <div style={{ fontSize: 28, fontWeight: 700, color: STATUS_LABEL[s].color }}>{counts[s]}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{STATUS_LABEL[s].label}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 13, padding: "7px 16px", borderRadius: 8, border: "1px solid #e5e7eb", cursor: "pointer", background: filter === f ? "#1e293b" : "#fff", color: filter === f ? "#fff" : "#374151", fontWeight: filter === f ? 600 : 400 }}>
              {f === "all" ? "Todos" : STATUS_LABEL[f].label}
            </button>
          ))}
        </div>

        {/* Docs table */}
        {filtered.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "48px 20px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            No hay documentos en este estado.
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Transportista", "Tipo", "Documento", "Estado", "Fecha", "Acciones"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, i) => {
                  const st = STATUS_LABEL[doc.status];
                  return (
                    <tr key={doc.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{doc.driver_name}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>{doc.driver_email}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 500, color: "#374151" }}>
                        {TIPO_LABEL[doc.tipo] ?? doc.tipo}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <button onClick={() => setPreviewUrl(doc.url)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", color: "#2563eb", fontWeight: 500 }}>
                          Ver imagen
                        </button>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: st.bg, color: st.color, fontWeight: 600 }}>
                          {st.label}
                        </span>
                        {doc.admin_note && (
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, maxWidth: 180 }}>{doc.admin_note}</div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 12, color: "#9ca3af" }}>
                        {new Date(doc.created_at).toLocaleDateString("es-AR")}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {doc.status === "pending" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => handleAction(doc, "approved")} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#d1fae5", color: "#065f46", cursor: "pointer", fontWeight: 600 }}>
                              Aprobar
                            </button>
                            <button onClick={() => handleAction(doc, "rejected")} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#991b1b", cursor: "pointer", fontWeight: 600 }}>
                              Rechazar
                            </button>
                          </div>
                        )}
                        {doc.status !== "pending" && (
                          <button onClick={() => handleAction(doc, doc.status === "approved" ? "rejected" : "approved")} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", cursor: "pointer" }}>
                            Cambiar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Note modal */}
      {noteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
              {noteModal.action === "approved" ? "Aprobar documento" : "Rechazar documento"}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
              {TIPO_LABEL[noteModal.doc.tipo]} de {noteModal.doc.driver_name}
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={noteModal.action === "rejected" ? "Motivo del rechazo (requerido para rechazos)..." : "Nota opcional..."}
              style={{ width: "100%", height: 90, padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, resize: "none", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setNoteModal(null)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, cursor: "pointer", color: "#6b7280" }}>
                Cancelar
              </button>
              <button
                onClick={submitAction}
                disabled={submitting || (noteModal.action === "rejected" && !noteText.trim())}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: noteModal.action === "approved" ? "#065f46" : "#991b1b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Guardando..." : noteModal.action === "approved" ? "Confirmar aprobación" : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview modal */}
      {previewUrl && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} alt="Documento" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }} />
          <button onClick={() => setPreviewUrl(null)} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
      )}
    </div>
  );
}
