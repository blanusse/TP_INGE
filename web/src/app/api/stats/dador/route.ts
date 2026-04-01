import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET() {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const res = await apiFetch("/stats/dador", session.backendToken);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
