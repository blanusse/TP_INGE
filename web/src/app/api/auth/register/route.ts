import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(req: NextRequest) {
  if (!BACKEND_URL) {
    console.error("[register] BACKEND_URL no configurado");
    return NextResponse.json({ error: "Error de configuración del servidor." }, { status: 500 });
  }

  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[register] Error al conectar con el backend:", err);
    return NextResponse.json({ error: "No se pudo conectar con el servidor. Intentá de nuevo." }, { status: 503 });
  }
}
