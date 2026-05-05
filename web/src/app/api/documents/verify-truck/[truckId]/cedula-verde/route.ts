import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ truckId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { truckId } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${BACKEND_URL}/documents/verify-truck-cedula-verde/${truckId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.backendToken}` },
    body: fd,
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
