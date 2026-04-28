import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(`${BACKEND_URL}/documents/dni-status`, {
    headers: { Authorization: `Bearer ${session.backendToken}` },
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${BACKEND_URL}/documents/verify-dni`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.backendToken}` },
    body: fd,
  });

  return NextResponse.json(await res.json(), { status: res.status });
}
