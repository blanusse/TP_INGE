import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET() {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const res = await apiFetch("/offers/mine", session.backendToken);
  const data = await res.json();
  const wrapped = Array.isArray(data) ? { offers: data } : data;
  return NextResponse.json(wrapped, { status: res.status });
}
