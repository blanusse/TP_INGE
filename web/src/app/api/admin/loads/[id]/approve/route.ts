import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.backendToken || session.user?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const res = await apiFetch(`/admin/loads/${id}/approve`, session.backendToken, {
    method: "PATCH",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
