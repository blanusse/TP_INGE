import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ loadId: string }> },
) {
  const { loadId } = await params;
  const session = await auth();
  const token = session?.backendToken;

  const res = await fetch(`${BACKEND_URL}/location/${loadId}/simulation-status`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return NextResponse.json({ running: false });
  const data = await res.json();
  return NextResponse.json(data);
}
