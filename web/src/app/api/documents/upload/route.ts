import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const tipo = formData.get("tipo") as string | null;

  if (!file || !tipo) {
    return NextResponse.json({ error: "Missing file or tipo" }, { status: 400 });
  }

  // Forward the file directly to NestJS
  const fd = new FormData();
  fd.append("file", file);
  fd.append("tipo", tipo);

  const res = await fetch(`${BACKEND_URL}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.backendToken}` },
    body: fd,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: err.message ?? "Error uploading document" }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
