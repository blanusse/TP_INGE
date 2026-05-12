import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "No autorizado" }, { status: 401 });

  const res = await apiFetch("/documents/identity-status", session.backendToken);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
