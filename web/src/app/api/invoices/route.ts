import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import { User } from "@/lib/models/User";

// GET /api/invoices — facturas del dador (ofertas aceptadas = pagos realizados)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectDB();

  const shipper = await Shipper.findOne({ user_id: session.user.id }).lean();
  if (!shipper) return NextResponse.json({ invoices: [] });

  const loads = await Load.find({ shipper_id: shipper._id }, "_id cargo_type pickup_city dropoff_city").lean();
  if (loads.length === 0) return NextResponse.json({ invoices: [] });

  const loadIds = loads.map((l) => l._id);
  const loadMap = Object.fromEntries(loads.map((l) => [l._id.toString(), l]));

  const offers = await Offer.find({ load_id: { $in: loadIds }, status: "accepted" })
    .sort({ updated_at: -1, created_at: -1 })
    .lean();

  if (offers.length === 0) return NextResponse.json({ invoices: [] });

  // Enriquecer con nombre del camionero
  const driverIds = offers.map((o) => o.driver_id);
  const drivers = await User.find({ _id: { $in: driverIds } }, "name").lean();
  const driverMap = Object.fromEntries(drivers.map((d) => [d._id.toString(), d.name as string]));

  const invoices = offers.map((o, idx) => {
    const load = loadMap[o.load_id.toString()];
    const concepto = load
      ? `${load.cargo_type ?? "Carga"} ${load.pickup_city} → ${load.dropoff_city}`
      : "Carga";
    const date = new Date(o.created_at);
    const numero = String(offers.length - idx).padStart(3, "0");
    return {
      id:        `F-${date.getFullYear()}-${numero}`,
      offerId:   o._id.toString(),
      fecha:     date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }),
      concepto,
      camionero: driverMap[o.driver_id.toString()] ?? "Camionero",
      monto:     o.price,
      estado:    "Pagada",
    };
  });

  return NextResponse.json({ invoices });
}
