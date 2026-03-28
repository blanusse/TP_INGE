import { NextRequest, NextResponse } from "next/server";

interface NominatimResult {
  display_name: string;
  address: {
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

function formatLabel(item: NominatimResult): string {
  const a = item.address;
  const parts: string[] = [];

  // Calle o barrio
  if (a.road)    parts.push(a.road);
  else if (a.suburb) parts.push(a.suburb);

  // Ciudad
  const city = a.city || a.town || a.village || a.county;
  if (city) parts.push(city);

  // Provincia/Estado
  if (a.state) parts.push(a.state);

  // País (solo si no es Argentina para que sea más corto)
  if (a.country && a.country_code !== "ar") parts.push(a.country);

  return parts.length > 0 ? parts.join(", ") : item.display_name.split(",").slice(0, 3).join(",").trim();
}

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(q)}` +
    `&format=json&limit=6&addressdetails=1` +
    `&countrycodes=ar,cl,br,uy,py,bo,pe`;   // Sudamérica

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "CargaBack/1.0 (student-logistics-project)",
        "Accept-Language": "es",
      },
      next: { revalidate: 60 }, // cache 60s
    });

    if (!res.ok) return NextResponse.json({ results: [] });

    const data: NominatimResult[] = await res.json();

    const results = data.map((item) => ({
      label: formatLabel(item),
      full:  item.display_name,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
