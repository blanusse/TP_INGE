import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ loadId: string }> },
) {
  const { loadId } = await params;
  const session = await auth();
  const token = session?.backendToken;

  // Si hay sesión, reenviamos el token. Si no, llamamos sin auth: en dev el
  // backend lo permite (DevPublicJwtGuard); en prod devolverá 401 y caemos a null.
  const res = await fetch(`${BACKEND_URL}/location/${loadId}/last`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return NextResponse.json(null);
  const data = await res.json();
  return NextResponse.json(data);
}
