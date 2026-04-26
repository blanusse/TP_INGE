import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ loadId: string }> },
) {
  const { loadId } = await params;
  const res = await fetch(`${BACKEND_URL}/location/${loadId}/last`);
  if (!res.ok) return NextResponse.json(null);
  const data = await res.json();
  return NextResponse.json(data);
}
