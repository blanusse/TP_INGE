import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET() {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const res = await apiFetch("/offers/mine", session.backendToken);
  const offers = await res.json();

  if (!Array.isArray(offers)) return NextResponse.json(offers, { status: res.status });

  const now = new Date();
  const enCurso = offers.filter((o: any) =>
    o.status === "accepted" && o.load?.status === "in_transit" &&
    (!o.load.ready_at || new Date(o.load.ready_at) <= now)
  );
  const proximos = offers.filter((o: any) =>
    o.status === "accepted" &&
    (o.load?.status === "matched" || (o.load?.status === "in_transit" && o.load.ready_at && new Date(o.load.ready_at) > now))
  );
  const completados = offers.filter((o: any) =>
    o.status === "accepted" && o.load?.status === "delivered"
  );

  return NextResponse.json({ enCurso, proximos, completados });
}
