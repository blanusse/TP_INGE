import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
  }

  const res = await fetch(`${BACKEND_URL}/auth/mp/connect`, {
    headers: { Authorization: `Bearer ${session.backendToken}` },
    redirect: "manual",
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (location) return NextResponse.redirect(location);
  }

  return NextResponse.json(
    { error: "No se pudo iniciar la conexión con MercadoPago." },
    { status: 502 }
  );
}