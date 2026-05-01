"use client";

import { useState, useRef } from "react";

const REASON_OPTIONS = [
  { value: "fraud", label: "Fraude / estafa" },
  { value: "non_delivery", label: "Incumplimiento de entrega" },
  { value: "harassment", label: "Acoso / lenguaje inapropiado" },
  { value: "fake_data", label: "Datos falsos" },
  { value: "other", label: "Otro" },
];

interface ModalReportarProps {
  reportedUserId: string;
  reportedUserName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalReportar({
  reportedUserId,
  reportedUserName,
  onClose,
  onSuccess,
}: ModalReportarProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handleSubmit = async () => {
    if (!reason) { setError("Seleccioná un motivo."); return; }
    if (description.length < 20) { setError("La descripción debe tener al menos 20 caracteres."); return; }

    setSending(true);
    setError("");

    try {
      let evidenceUrl: string | undefined;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/reports/upload-evidence", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Error al subir la evidencia.");
        const uploadData = await uploadRes.json();
        evidenceUrl = uploadData.url;
      }

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reported_id: reportedUserId,
          reason,
          description,
          evidence_url: evidenceUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Error al enviar el reporte.");
      }

      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl"
        >
          &times;
        </button>

        <h3 className="text-lg font-semibold text-gray-900 mb-1">Reportar usuario</h3>
        <p className="text-sm text-gray-500 mb-4">
          Reportando a <span className="font-medium text-gray-700">{reportedUserName}</span>
        </p>

        {success ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2 text-[#3a806b]">&#10003;</div>
            <p className="text-[#3a806b] font-medium">Reporte enviado correctamente.</p>
            <p className="text-sm text-gray-500 mt-1">Un administrador lo revisará pronto.</p>
          </div>
        ) : (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#3a806b] focus:border-transparent"
            >
              <option value="">Seleccioná un motivo...</option>
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción <span className="text-gray-400 font-normal">(mín. 20 caracteres)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describí el problema con el mayor detalle posible..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3a806b] focus:border-transparent"
            />

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evidencia <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="mb-4">
              {preview ? (
                <div className="relative inline-block">
                  <img src={preview} alt="Evidencia" className="w-32 h-32 object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-500 hover:border-[#3a806b] hover:text-[#3a806b] transition-colors w-full"
                >
                  Subir imagen (jpg, png, webp)
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 mb-3">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={sending}
              className="w-full py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
            >
              {sending ? "Enviando..." : "Enviar reporte"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
