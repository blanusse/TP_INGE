import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { Rating } from "@/lib/models/Rating";
import mongoose from "mongoose";

const CARGO_COLORS: Record<string, string> = {
  General:     "#16a34a",
  Granel:      "#3b82f6",
  Refrigerado: "#f59e0b",
  Plataforma:  "#8b5cf6",
  Peligroso:   "#ef4444",
  Frágil:      "#ec4899",
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectDB();

  const userId = new mongoose.Types.ObjectId(session.user.id);

  // Ofertas aceptadas por este camionero
  const acceptedOffers = await Offer.find({ driver_id: userId, status: "accepted" }).lean();
  const loadIds        = acceptedOffers.map((o) => o.load_id);

  // Cargas entregadas
  const deliveredLoads = await Load.find({ _id: { $in: loadIds }, status: "delivered" }).lean();
  const viajesCompletados = deliveredLoads.length;

  // Map loadId → offer price
  const priceByLoad = Object.fromEntries(acceptedOffers.map((o) => [o.load_id.toString(), o.price]));

  // ── Ingresos últimos 6 meses ────────────────────────────────────────────────
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  // Inicializar los 6 meses con 0
  const monthMap: Record<string, { mes: string; monto: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-AR", { month: "short" });
    monthMap[key] = { mes: label.charAt(0).toUpperCase() + label.slice(1, 3), monto: 0 };
  }

  let totalIngresos6m = 0;
  let viajes6m        = 0;

  for (const load of deliveredLoads) {
    const date = load.ready_at ? new Date(load.ready_at) : new Date(load.created_at);
    if (date < sixMonthsAgo) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const price = priceByLoad[load._id.toString()] ?? 0;
    if (monthMap[key]) {
      monthMap[key].monto += price;
      totalIngresos6m += price;
      viajes6m++;
    }
  }
  const ingresosUltimos6Meses = Object.values(monthMap);

  // ── Tipos de carga ──────────────────────────────────────────────────────────
  const cargaCount: Record<string, number> = {};
  for (const load of deliveredLoads) {
    const tipo = load.cargo_type ?? "General";
    cargaCount[tipo] = (cargaCount[tipo] ?? 0) + 1;
  }
  const totalCargas = Object.values(cargaCount).reduce((s, v) => s + v, 0) || 1;
  const tiposCarga = Object.entries(cargaCount)
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, count]) => ({
      tipo,
      count,
      pct: Math.round((count / totalCargas) * 100),
      color: CARGO_COLORS[tipo] ?? "#6b7280",
    }));

  // ── Rutas más frecuentes ────────────────────────────────────────────────────
  const routeCount: Record<string, number> = {};
  for (const load of deliveredLoads) {
    const ruta = `${load.pickup_city} → ${load.dropoff_city}`;
    routeCount[ruta] = (routeCount[ruta] ?? 0) + 1;
  }
  const rutasFrecuentes = Object.entries(routeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ruta, viajes]) => ({ ruta, viajes }));

  // ── Calificación promedio ───────────────────────────────────────────────────
  const ratingAgg = await Rating.aggregate([
    { $match: { to_user_id: userId } },
    { $group: { _id: null, avg: { $avg: "$score" } } },
  ]);
  const avg = ratingAgg[0]?.avg ?? null;

  const memberSince = new Date(userId.getTimestamp()).toLocaleDateString("es-AR", {
    month: "short",
    year:  "numeric",
  });

  return NextResponse.json({
    viajesCompletados,
    calificacionPromedio: avg !== null ? Math.round(avg * 10) / 10 : null,
    memberSince,
    ingresosUltimos6Meses,
    tiposCarga,
    rutasFrecuentes,
    totalIngresos6m,
    viajes6m,
  });
}
