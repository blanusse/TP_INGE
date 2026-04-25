import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

// GET /api/invoices — facturas del dador (pagos confirmados)
export async function GET() {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const res = await apiFetch("/payments/mine", session.backendToken);
  if (!res.ok) return NextResponse.json({ invoices: [] }, { status: res.status });

  const payments: Array<Record<string, unknown>> = await res.json();

  const invoices = payments.map((p, idx) => {
    const date = new Date(p.created_at as string);
    const numero = String(payments.length - idx).padStart(3, "0");
    const concepto = `${p.cargo_type ?? "Carga"} ${p.pickup_city} → ${p.dropoff_city}`;

    return {
      id:        `F-${date.getFullYear()}-${numero}`,
      paymentId: p.id as string,
      offerId:   p.offer_id,
      fecha:     date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }),
      concepto,
      camionero: (p.driver_name as string) ?? "Camionero",
      monto:     Number(p.amount),
      estado:    p.status === "confirmed" ? "Pagada" : "Pendiente",
    };
  });

  return NextResponse.json({ invoices });
}
