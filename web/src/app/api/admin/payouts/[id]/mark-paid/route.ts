import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

function isAuthorized(req: NextRequest, session: Awaited<ReturnType<typeof auth>>) {
  if (session?.user?.role === "admin") return true;
  const clientSecret = req.headers.get("x-internal-secret");
  return INTERNAL_SECRET !== "" && clientSecret === INTERNAL_SECRET;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!isAuthorized(req, session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const res = await fetch(`${BACKEND_URL}/payments/internal/${id}/mark-paid`, {
    method: "POST",
    headers: { "x-internal-secret": INTERNAL_SECRET },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
