import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const searchParams = new URL(req.url).searchParams;
  const loadId = searchParams.get("loadId") ?? searchParams.get("load_id");
  const suffix = loadId ? `?load_id=${encodeURIComponent(loadId)}` : "";

  const res = await apiFetch(`/insurance/policies${suffix}`, session.backendToken);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
