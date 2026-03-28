import { NextRequest, NextResponse } from "next/server";

// Tarifa base por km según tipo de carga (ARS/km)
const TARIFA_BASE: Record<string, number> = {
  General:      700,
  Granel:       650,
  Refrigerado:  950,  // requiere equipo especial
  Plataforma:   750,
  Peligroso:   1100,  // materiales peligrosos, seguro extra
  Frágil:       900,
};

const TARIFA_DEFAULT = 700;
const PRECIO_MINIMO_ABSOLUTO = 30_000; // ARS — ningún viaje puede costar menos

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getCoords(place: string): Promise<{ lat: number; lon: number } | null> {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(place)}&format=json&limit=1&countrycodes=ar,cl,br,uy,py,bo,pe`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "CargaBack/1.0 (student-logistics-project)", "Accept-Language": "es" },
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// GET /api/estimate-price?origen=...&destino=...&tipoCarga=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const origen    = searchParams.get("origen")    ?? "";
  const destino   = searchParams.get("destino")   ?? "";
  const tipoCarga = searchParams.get("tipoCarga") ?? "General";

  if (!origen || !destino) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const [coordsO, coordsD] = await Promise.all([getCoords(origen), getCoords(destino)]);

  if (!coordsO || !coordsD) {
    return NextResponse.json({ error: "No se encontraron coordenadas para los puntos" }, { status: 422 });
  }

  const distanceKm = Math.round(haversineKm(coordsO.lat, coordsO.lon, coordsD.lat, coordsD.lon));

  const tarifaBase = TARIFA_BASE[tipoCarga] ?? TARIFA_DEFAULT;

  // Descuento de escala: rutas largas son más eficientes
  let factorDistancia = 1;
  if (distanceKm > 800) factorDistancia = 0.85;
  else if (distanceKm > 400) factorDistancia = 0.92;

  const suggestedPrice = Math.round(distanceKm * tarifaBase * factorDistancia / 1000) * 1000;
  const minPrice = Math.max(
    Math.round(distanceKm * (tarifaBase * 0.6) / 1000) * 1000,
    PRECIO_MINIMO_ABSOLUTO
  );
  const maxPrice = Math.round(distanceKm * (tarifaBase * 1.4) / 1000) * 1000;

  return NextResponse.json({
    distanceKm,
    minPrice,
    suggestedPrice,
    maxPrice,
    tarifaBase,
  });
}
