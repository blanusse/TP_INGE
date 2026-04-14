import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const res = await apiFetch(`/fleet/drivers/${id}`, session.backendToken, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const wrapped = res.ok ? { driver: data } : data;
  return NextResponse.json(wrapped, { status: res.status });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await params;
  const res = await apiFetch(`/fleet/drivers/${id}`, session.backendToken, { method: "DELETE" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
