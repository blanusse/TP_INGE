import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

const COMMISSION_RATE = 0.10;
const grossToNet = (gross: number) => Math.round(gross * (1 - COMMISSION_RATE) * 100) / 100;

export async function GET() {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const res = await apiFetch("/offers/mine", session.backendToken);
  const offers = await res.json();

  if (!Array.isArray(offers)) return NextResponse.json(offers, { status: res.status });

  const now = new Date();

  interface OfferWithLoad {
    id: string;
    load_id: string;
    status: string;
    price: number;
    load?: {
      cargo_type?: string;
      pickup_city?: string;
      dropoff_city?: string;
      pickup_exact?: string;
      dropoff_exact?: string;
      pickup_lat?: string;
      pickup_lon?: string;
      dropoff_lat?: string;
      dropoff_lon?: string;
      truck_type_required?: string;
      status?: string;
      ready_at?: string;
      shipper?: { razon_social?: string; user_id?: string };
    };
  }

  const toViaje = (o: OfferWithLoad) => ({
    offerId: o.id,
    loadId: o.load_id,
    titulo: `${o.load?.cargo_type ?? "Transporte"} \u2014 ${o.load?.pickup_city ?? ""} \u2192 ${o.load?.dropoff_city ?? ""}`,
    empresa: o.load?.shipper?.razon_social ?? "Dador de carga",
    empresaUserId: o.load?.shipper?.user_id ?? null,
    precio: grossToNet(Number(o.price)),
    fechaRetiro: o.load?.ready_at
      ? new Date(o.load.ready_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "-",
    pickupCity: o.load?.pickup_city ?? "",
    dropoffCity: o.load?.dropoff_city ?? "",
    pickupExact: o.load?.pickup_exact ?? null,
    dropoffExact: o.load?.dropoff_exact ?? null,
    pickupLat: o.load?.pickup_lat ? Number(o.load.pickup_lat) : null,
    pickupLon: o.load?.pickup_lon ? Number(o.load.pickup_lon) : null,
    dropoffLat: o.load?.dropoff_lat ? Number(o.load.dropoff_lat) : null,
    dropoffLon: o.load?.dropoff_lon ? Number(o.load.dropoff_lon) : null,
    truckType: o.load?.truck_type_required ?? null,
    status: o.load?.status ?? "unknown",
    yaCalifiqué: false,
  });

  const enCurso = offers
    .filter((o: OfferWithLoad) =>
      o.status === "accepted" && o.load?.status === "in_transit" &&
      (!o.load.ready_at || new Date(o.load.ready_at) <= now)
    )
    .map(toViaje);

  const proximos = offers
    .filter((o: OfferWithLoad) =>
      o.status === "accepted" &&
      (o.load?.status === "matched" || (o.load?.status === "in_transit" && o.load.ready_at && new Date(o.load.ready_at) > now))
    )
    .map(toViaje);

  const completados = offers
    .filter((o: OfferWithLoad) => o.status === "accepted" && o.load?.status === "delivered")
    .map(toViaje);

  return NextResponse.json({ enCurso, proximos, completados });
}
