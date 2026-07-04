import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ loadId: string }> },
) {
  const { loadId } = await params;
  const session = await auth();
  const token = session?.backendToken;

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  };
  // Si hay sesión, reenviamos el token. Si no, va sin auth: en dev el backend
  // lo permite (DevPublicJwtGuard); en prod devolverá 401.
  if (token) headers.Authorization = `Bearer ${token}`;

  const backendRes = await fetch(`${BACKEND_URL}/location/${loadId}/stream`, {
    headers,
  });

  if (!backendRes.ok || !backendRes.body) {
    return new NextResponse("Stream unavailable", { status: 502 });
  }

  return new NextResponse(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
