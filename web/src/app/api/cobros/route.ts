import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  if (searchParams.get("from")) params.set("from", searchParams.get("from")!);
  if (searchParams.get("to"))   params.set("to",   searchParams.get("to")!);

  const res = await apiFetch(`/stats/cobros?${params}`, session.backendToken);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
