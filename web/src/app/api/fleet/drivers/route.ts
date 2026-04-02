import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET() {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const res = await apiFetch("/fleet/drivers", session.backendToken);
  const data = await res.json();
  const wrapped = Array.isArray(data) ? { drivers: data } : data;
  return NextResponse.json(wrapped, { status: res.status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json();
  const res = await apiFetch("/fleet/drivers", session.backendToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  // Omitir password_hash y wrappear en { driver }
  if (res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...driver } = data;
    return NextResponse.json({ driver }, { status: res.status });
  }
  return NextResponse.json(data, { status: res.status });
}
