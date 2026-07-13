import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ loadId: string }> },
) {
  const { loadId } = await params;
  const session = await auth();
  const token = session?.backendToken;
  if (!token)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const res = await fetch(`${BACKEND_URL}/location/${loadId}/simulate/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
