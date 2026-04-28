import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const endpoint = session.user.role === "admin" ? "/documents/all" : "/documents/mine";

  const res = await fetch(`${BACKEND_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${session.backendToken}` },
  });

  if (!res.ok) return NextResponse.json([], { status: res.status });
  return NextResponse.json(await res.json());
}
