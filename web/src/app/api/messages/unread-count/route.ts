import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET() {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ count: 0 });

  const res = await apiFetch("/messages/unread-count", session.backendToken);
  if (!res.ok) return NextResponse.json({ count: 0 });
  const data = await res.json();
  return NextResponse.json(data);
}
