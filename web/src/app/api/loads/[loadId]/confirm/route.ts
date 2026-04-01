import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function POST(req: NextRequest, { params }: { params: Promise<{ loadId: string }> }) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { loadId } = await params;
  const res = await apiFetch(`/loads/${loadId}/confirm`, session.backendToken, { method: "PATCH" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
