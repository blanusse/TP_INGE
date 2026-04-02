import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET() {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const res = await apiFetch("/stats/camionero", session.backendToken);
  const data = await res.json();
  if (!res.ok) return NextResponse.json(data, { status: res.status });

  const COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
  const totalCargas = (data.tiposCarga ?? []).reduce((s: number, c: { cantidad: number }) => s + c.cantidad, 0);
  const tiposCarga = (data.tiposCarga ?? []).map((c: { tipo: string; cantidad: number }, i: number) => ({
    tipo: c.tipo,
    count: c.cantidad,
    pct: totalCargas > 0 ? Math.round((c.cantidad / totalCargas) * 100) : 0,
    color: COLORS[i % COLORS.length],
  }));

  // El frontend usa e.monto pero el backend devuelve e.ingresos → renombrar
  const ingresosUltimos6Meses = (data.ingresosUltimos6Meses ?? []).map(
    (e: { mes: string; ingresos: number }) => ({ mes: e.mes, monto: e.ingresos })
  );

  return NextResponse.json({ ...data, tiposCarga, ingresosUltimos6Meses }, { status: res.status });
}
