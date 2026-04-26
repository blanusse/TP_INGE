import { NextRequest, NextResponse } from "next/server";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  class: string;
  address: {
    road?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

/** Etiqueta completa con calle — mostrada al dador que escribe */
function formatLabel(item: NominatimResult): string {
  const a = item.address;
  const parts: string[] = [];

  if (a.road) {
    parts.push(a.house_number ? `${a.road} ${a.house_number}` : a.road);
  } else if (a.suburb || a.neighbourhood) {
    parts.push((a.suburb || a.neighbourhood)!);
  }

  const city = a.city || a.town || a.village || a.county;
  if (city) parts.push(city);

  if (a.state) parts.push(a.state);
  if (a.country && a.country_code !== "ar") parts.push(a.country);

  return parts.length > 0 ? parts.join(", ") : item.display_name.split(",").slice(0, 3).join(",").trim();
}

/** Zona aproximada sin calle — mostrada a camioneros que aún no tienen la carga */
function formatZone(item: NominatimResult): string {
  const a = item.address;
  const parts: string[] = [];

  // Barrio o distrito (no la calle)
  const barrio = a.suburb || a.neighbourhood || a.city_district;
  if (barrio) parts.push(barrio);

  const city = a.city || a.town || a.village || a.county;
  if (city) parts.push(city);

  if (a.state && a.state !== city) parts.push(a.state);
  if (a.country && a.country_code !== "ar") parts.push(a.country);

  return parts.length > 0
    ? parts.join(", ")
    : item.display_name.split(",").slice(-3).join(",").trim();
}

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(q)}` +
    `&format=json&limit=6&addressdetails=1` +
    `&countrycodes=ar,cl,br,uy,py,bo,pe`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":      "CargaBack/1.0 (student-logistics-project)",
        "Accept-Language": "es",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) return NextResponse.json({ results: [] });

    const data: NominatimResult[] = await res.json();

    // Solo resultados con calle y número — excluye calles sin altura, ciudades, provincias
    const streetLevel = data.filter((item) => !!item.address.road && !!item.address.house_number);

    const seen = new Set<string>();
    const results = streetLevel
      .map((item) => ({
        label: formatLabel(item),
        zone:  formatZone(item),
        full:  item.display_name,
        lat:   parseFloat(item.lat),
        lon:   parseFloat(item.lon),
      }))
      .filter((r) => {
        if (seen.has(r.zone)) return false;
        seen.add(r.zone);
        return true;
      });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
