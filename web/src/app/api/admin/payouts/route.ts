import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

function isAuthorized(req: NextRequest, session: Awaited<ReturnType<typeof auth>>) {
  if (session?.user?.role === "admin") return true;
  const clientSecret = req.headers.get("x-internal-secret");
  return INTERNAL_SECRET !== "" && clientSecret === INTERNAL_SECRET;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!isAuthorized(req, session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const res = await fetch(`${BACKEND_URL}/payments/admin/payouts`, {
    headers: { "x-internal-secret": INTERNAL_SECRET },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
