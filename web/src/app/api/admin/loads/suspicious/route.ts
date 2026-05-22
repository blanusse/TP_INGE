import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken || session.user?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();
  const res = await apiFetch(`/admin/loads/suspicious${qs ? `?${qs}` : ""}`, session.backendToken);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
