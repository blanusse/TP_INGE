import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const res = await fetch(`${BACKEND_URL}/payments/admin/payouts`, {
    headers: { "x-internal-secret": process.env.INTERNAL_SECRET ?? "" },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
