import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const numero = new URL(req.url).searchParams.get("numero") ?? "";

  const res = await apiFetch(
    `/payments/${id}/invoice?numero=${encodeURIComponent(numero)}`,
    session.backendToken,
  );

  if (!res.ok) return NextResponse.json({ error: "No se pudo generar la factura" }, { status: res.status });

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="factura-${numero || id}.pdf"`,
    },
  });
}
