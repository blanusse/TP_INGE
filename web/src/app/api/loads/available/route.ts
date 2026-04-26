import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";
const COMMISSION_RATE = 0.10;
const grossToNet = (gross: number) => Math.round(gross * (1 - COMMISSION_RATE) * 100) / 100;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  if (searchParams.get("cargo_type")) params.set("cargo_type", searchParams.get("cargo_type")!);
  if (searchParams.get("origin"))     params.set("origin", searchParams.get("origin")!);

  const res = await fetch(`${BACKEND_URL}/loads/available?${params}`);
  const data = await res.json();
  // El transportista ve el precio neto (lo que recibirá tras la comisión del 10%)
  const loads = Array.isArray(data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? data.map((l: any) => ({ ...l, price_base: l.price_base != null ? grossToNet(Number(l.price_base)) : l.price_base }))
    : data;
  const wrapped = Array.isArray(loads) ? { loads } : loads;
  return NextResponse.json(wrapped, { status: res.status });
}
