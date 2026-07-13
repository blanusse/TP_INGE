import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== "admin" || !session.backendToken) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  // El backend exige JWT (JwtAuthGuard) además del secreto interno
  const res = await fetch(`${BACKEND_URL}/payments/internal/${id}/mark-paid`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
      "x-internal-secret": INTERNAL_SECRET,
    },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
