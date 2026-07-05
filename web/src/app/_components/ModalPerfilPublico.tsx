"use client";

import { useEffect, useState } from "react";

interface PublicProfile {
  id: string;
  name: string;
  role: string;
  created_at: string;
  avg_rating: number;
  rating_count: number;
  trips_completed: number;
}

interface RatingEntry {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  from_user?: { id: string; name: string } | null;
}

interface ModalPerfilPublicoProps {
  userId: string;
  onClose: () => void;
  onReportar: () => void;
}

export default function ModalPerfilPublico({ userId, onClose, onReportar }: ModalPerfilPublicoProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [ratings, setRatings] = useState<RatingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/users/${userId}/public-profile`).then((r) => r.json()),
      fetch(`/api/ratings/user/${userId}`).then((r) => r.json()),
    ])
      .then(([profileData, ratingsData]) => {
        setProfile(profileData);
        if (Array.isArray(ratingsData)) setRatings(ratingsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const iniciales = profile?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  const roleLabel = profile?.role === "shipper" ? "Dador de carga" : "Transportista";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("es-AR", { year: "numeric", month: "long" })
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl"
        >
          ×
        </button>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a806b]" />
          </div>
        ) : profile ? (
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-[#3a806b] flex items-center justify-center text-white text-xl font-bold mb-3">
              {iniciales}
            </div>

            {/* Name & Role */}
            <h3 className="text-lg font-semibold text-gray-900">{profile.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{roleLabel}</p>

            {/* Stats */}
            <div className="flex gap-6 mb-4">
              <div className="text-center">
                <p className="text-xl font-bold text-[#3a806b]">
                  {profile.avg_rating > 0 ? profile.avg_rating.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-gray-500">Calificación</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-[#3a806b]">{profile.trips_completed}</p>
                <p className="text-xs text-gray-500">Viajes</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-[#3a806b]">{profile.rating_count}</p>
                <p className="text-xs text-gray-500">Reseñas</p>
              </div>
            </div>

            {/* Member since */}
            <p className="text-xs text-gray-400 mb-4">Miembro desde {memberSince}</p>

            {/* Ratings */}
            <div className="w-full mb-4 text-left">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reseñas</p>
              {ratings.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <div className="text-2xl mb-1">⭐</div>
                  <p className="text-xs">Aún no hay reseñas</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                  {ratings.map((r) => (
                    <div key={r.id} className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{r.from_user?.name ?? "Usuario"}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(r.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 mb-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} style={{ fontSize: 12, color: s <= r.score ? "#f59e0b" : "#d1d5db" }}>★</span>
                        ))}
                      </div>
                      {r.comment
                        ? <p className="text-xs text-gray-700">{r.comment}</p>
                        : <p className="text-xs text-gray-400 italic">Sin comentario</p>
                      }
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Report button */}
            <button
              onClick={onReportar}
              className="w-full py-2 px-4 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
            >
              Reportar usuario
            </button>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No se pudo cargar el perfil.</p>
        )}
      </div>
    </div>
  );
}
